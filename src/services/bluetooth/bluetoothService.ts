import {
  LATENCY_ALERT_MS,
  LATENCY_TEST_INTERVAL_MS,
  LATENCY_TEST_SAMPLE_WINDOW,
  LATENCY_WARNING_MS
} from "../../core/constants.js";
import { encodeControlPayload, isBluetoothAvailable } from "./bleUtils.js";
import type { AppState } from "../../state/types.js";
import type { BLE_CONFIG } from "./bleConfig.js";
import { BleTransport } from "./bleTransport.js";
import { LatencyMonitor } from "./latencyMonitor.js";
import { parseTelemetrySample } from "./telemetryParser.js";

export type LatencyWarningLevel = "hidden" | "warning" | "alert";

export type BluetoothServiceOptions = {
  state: AppState;
  bleConfig: typeof BLE_CONFIG;
  onUpdateUI: () => void;
  onLatencyWarning: (message: string, level: LatencyWarningLevel) => void;
  onSample: (sample: number) => void;
};

export class BluetoothService {
  private state: AppState;
  private onUpdateUI: () => void;
  private onSample: (sample: number) => void;
  private latencyTestTimer: number | null = null;
  private latencyTestTimeout: number | null = null;
  private latencyTestInFlight = false;
  private transport: BleTransport;
  private latencyMonitor: LatencyMonitor;
  private onLatencyWarning: (message: string, level: LatencyWarningLevel) => void;

  constructor(options: BluetoothServiceOptions) {
    this.state = options.state;
    this.onUpdateUI = options.onUpdateUI;
    this.onLatencyWarning = options.onLatencyWarning;
    this.onSample = options.onSample;
    this.transport = new BleTransport({
      bleConfig: options.bleConfig,
      onDisconnect: this.handleBluetoothDisconnect
    });
    this.latencyMonitor = new LatencyMonitor({
      state: this.state.connection,
      onLatencyWarning: this.onLatencyWarning
    });
  }

  isAvailable() {
    return isBluetoothAvailable();
  }

  isStreaming() {
    return Boolean(
      this.state.connection.mode === "bluetooth" &&
        this.state.connection.status === "connected" &&
        this.state.connection.telemetryChar
    );
  }

  private resetPerStats() {
    this.state.connection.perStats = {
      lastSeq: null,
      received: 0,
      dropped: 0
    };
  }

  private resetLatencyTestState() {
    this.state.connection.lastPingAt = null;
    this.state.connection.lastPingSeq = 0;
    this.state.connection.latencyTest.active = false;
    this.state.connection.latencyTest.samples = [];
    this.state.connection.latencyTest.pendingSeq = null;
  }

  resetConnectionMetrics() {
    this.state.connection.latency = null;
    this.state.connection.per = null;
    this.resetPerStats();
    this.resetLatencyTestState();
  }

  private clearBluetoothState() {
    if (this.state.connection.telemetryChar) {
      (this.state.connection.telemetryChar as BluetoothRemoteGATTCharacteristic).removeEventListener(
        "characteristicvaluechanged",
        this.handleBluetoothTelemetry
      );
    }
    this.state.connection.device = null;
    this.state.connection.server = null;
    this.state.connection.controlChar = null;
    this.state.connection.telemetryChar = null;
    this.state.connection.lastPingAt = null;
    this.state.connection.lastPingSeq = 0;
    this.state.connection.latencyTest.pendingSeq = null;
  }

  private handleBluetoothDisconnect = () => {
    this.stopLatencyTest();
    this.clearBluetoothState();
    this.state.connection.status = "disconnected";
    this.resetConnectionMetrics();
    this.onUpdateUI();
  };

  private updatePerFromSeq(seq: number) {
    if (!Number.isFinite(seq)) return;
    const stats = this.state.connection.perStats;

    if (stats.lastSeq !== null && seq <= stats.lastSeq) {
      stats.lastSeq = seq;
      stats.received = 1;
      stats.dropped = 0;
      this.state.connection.per = 0;
      return;
    }

    if (stats.lastSeq !== null && seq > stats.lastSeq + 1) {
      stats.dropped += seq - stats.lastSeq - 1;
    }

    stats.received += 1;
    stats.lastSeq = seq;
    const total = stats.received + stats.dropped;
    this.state.connection.per = total > 0 ? Number(((stats.dropped / total) * 100).toFixed(2)) : 0;
  }

  private recordLatencySample(latency: number) {
    if (!this.state.connection.latencyTest.active) return;
    const samples = this.state.connection.latencyTest.samples;
    samples.push(latency);
    if (samples.length > LATENCY_TEST_SAMPLE_WINDOW) {
      samples.shift();
    }
  }

  private handleBluetoothTelemetry = (event: Event) => {
    const parsed = parseTelemetrySample(event);
    if (!parsed) return;
    parsed.samples.forEach((sample) => this.onSample(sample));
    if (Number.isFinite(parsed.sample)) {
      this.onSample(parsed.sample);
    }
    if (Number.isFinite(parsed.seq)) {
      this.updatePerFromSeq(parsed.seq);
    }

    if (parsed.isPong) {
      if (Number.isFinite(parsed.ts)) {
        this.state.connection.latency = Date.now() - parsed.ts;
      } else if (
        this.state.connection.lastPingAt &&
        (!Number.isFinite(parsed.seq) || parsed.seq === this.state.connection.lastPingSeq)
      ) {
        this.state.connection.latency = Date.now() - this.state.connection.lastPingAt;
      }
      this.state.connection.latencyTest.pendingSeq = null;
      if (this.state.connection.latency !== null) {
        this.recordLatencySample(this.state.connection.latency);
      }
    }

    if (Number.isFinite(parsed.latency)) {
      this.state.connection.latency = parsed.latency;
      this.recordLatencySample(parsed.latency);
    }
    if (Number.isFinite(parsed.per)) {
      this.state.connection.per = parsed.per;
    }
    this.latencyMonitor.updateLatency(this.state.connection.latency);
    this.onUpdateUI();
  };

  async sendCommand(payload: Record<string, unknown>) {
    if (this.state.connection.mode !== "bluetooth" || this.state.connection.status !== "connected") return;
    if (!this.state.connection.controlChar) return;
    try {
      const data = encodeControlPayload(payload);
      await this.transport.write(
        this.state.connection.controlChar as BluetoothRemoteGATTCharacteristic,
        data
      );
    } catch (error) {
      console.error("Bluetooth write failed", error);
      this.handleBluetoothDisconnect();
    }
  }

  private canRunLatencyTest() {
    return (
      this.state.connection.mode === "bluetooth" &&
      this.state.connection.status === "connected" &&
      this.isAvailable()
    );
  }

  private scheduleLatencyTimeout(seq: number) {
    if (this.latencyTestTimeout) {
      clearTimeout(this.latencyTestTimeout);
    }
    this.latencyTestTimeout = window.setTimeout(() => {
      if (!this.state.connection.latencyTest.active) return;
      if (this.state.connection.latencyTest.pendingSeq !== seq) return;
      this.onLatencyWarning("Latency test timed out — no response from device.", "alert");
    }, Math.max(LATENCY_ALERT_MS, LATENCY_TEST_INTERVAL_MS));
  }

  private async runLatencyTestPing() {
    if (!this.canRunLatencyTest() || this.latencyTestInFlight) return;
    this.latencyTestInFlight = true;
    try {
      const seq = this.state.connection.lastPingSeq + 1;
      this.state.connection.lastPingSeq = seq;
      this.state.connection.lastPingAt = Date.now();
      this.state.connection.latencyTest.pendingSeq = seq;
      await this.sendCommand({ type: "ping", ts: this.state.connection.lastPingAt, seq });
      this.scheduleLatencyTimeout(seq);
    } finally {
      this.latencyTestInFlight = false;
    }
  }

  startLatencyTest() {
    if (this.state.connection.latencyTest.active) return;
    if (!this.canRunLatencyTest()) {
      window.alert("Connect to a Bluetooth device before starting a latency test.");
      return;
    }
    this.state.connection.latencyTest.active = true;
    this.state.connection.latencyTest.samples = [];
    this.runLatencyTestPing();
    this.latencyTestTimer = window.setInterval(
      () => this.runLatencyTestPing(),
      LATENCY_TEST_INTERVAL_MS
    );
    this.onUpdateUI();
  }

  stopLatencyTest() {
    this.state.connection.latencyTest.active = false;
    this.state.connection.latencyTest.pendingSeq = null;
    if (this.latencyTestTimer) {
      clearInterval(this.latencyTestTimer);
      this.latencyTestTimer = null;
    }
    if (this.latencyTestTimeout) {
      clearTimeout(this.latencyTestTimeout);
      this.latencyTestTimeout = null;
    }
    this.onUpdateUI();
  }

  toggleLatencyTest() {
    if (this.state.connection.latencyTest.active) {
      this.stopLatencyTest();
    } else {
      this.startLatencyTest();
    }
  }

  async connect() {
    if (!this.isAvailable()) {
      window.alert("Bluetooth is unavailable. Use a secure context (HTTPS) and a compatible browser.");
      return;
    }

    this.state.connection.status = "connecting";
    this.onUpdateUI();

    try {
      const server = await this.transport.connect();
      const config = this.transport.getConfig();
      const service = await server.getPrimaryService(config.serviceUUID);
      const controlChar = await service.getCharacteristic(
        config.controlCharUUID
      );
      let telemetryChar: BluetoothRemoteGATTCharacteristic | null = null;
      try {
        telemetryChar = await service.getCharacteristic(config.telemetryCharUUID);
      } catch (error) {
        telemetryChar = null;
      }

      if (telemetryChar && telemetryChar.properties.notify) {
        await telemetryChar.startNotifications();
        telemetryChar.addEventListener("characteristicvaluechanged", this.handleBluetoothTelemetry);
      }

      this.state.connection.device = this.transport.getDevice();
      this.state.connection.server = server;
      this.state.connection.controlChar = controlChar;
      this.state.connection.telemetryChar = telemetryChar;
      this.state.connection.status = "connected";
      this.resetConnectionMetrics();
      this.onUpdateUI();
    } catch (error) {
      console.error("Bluetooth connection failed", error);
      this.handleBluetoothDisconnect();
    }
  }

  async disconnect() {
    await this.transport.disconnect();
    this.handleBluetoothDisconnect();
  }

  async ping() {
    if (this.state.connection.mode !== "bluetooth") return;
    if (this.state.connection.status !== "connected") return;
    const start = performance.now();
    const seq = this.state.connection.lastPingSeq + 1;
    this.state.connection.lastPingSeq = seq;
    this.state.connection.lastPingAt = Date.now();
    this.state.connection.latencyTest.pendingSeq = seq;
    await this.sendCommand({ type: "ping", ts: this.state.connection.lastPingAt, seq });
    this.scheduleLatencyTimeout(seq);
    this.state.connection.latency = Math.round(performance.now() - start);
    if (this.state.connection.per === null) {
      this.state.connection.per = 0;
    }
    this.onUpdateUI();
  }
}

export function getLatencyWarning(
  latency: number | null,
  isConnected: boolean
): { message: string; level: LatencyWarningLevel } {
  if (!isConnected || latency === null || latency === undefined) {
    return { message: "", level: "hidden" };
  }

  if (latency >= LATENCY_ALERT_MS) {
    return { message: `High latency detected (${Math.round(latency)} ms).`, level: "alert" };
  }

  if (latency >= LATENCY_WARNING_MS) {
    return { message: `Latency above target (${Math.round(latency)} ms).`, level: "warning" };
  }

  return { message: "", level: "hidden" };
}
