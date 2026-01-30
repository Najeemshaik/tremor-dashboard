import { randomBetween } from "../../core/math.js";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

export class MockConnectionService {
  private onStatus: (status: ConnectionStatus) => void;
  private onMetrics: (metrics: { latency: number; per: number }) => void;
  private connectTimer: number | null = null;
  private metricsTimer: number | null = null;
  private status: ConnectionStatus = "disconnected";

  constructor({ onStatus, onMetrics }: {
    onStatus: (status: ConnectionStatus) => void;
    onMetrics: (metrics: { latency: number; per: number }) => void;
  }) {
    this.onStatus = onStatus;
    this.onMetrics = onMetrics;
  }

  connect() {
    if (this.status === "connecting" || this.status === "connected") return;
    this.status = "connecting";
    this.onStatus(this.status);
    this.stopTimers();
    this.connectTimer = window.setTimeout(() => {
      this.status = "connected";
      this.onStatus(this.status);
      this.emitMetrics();
      if (!this.metricsTimer) {
        this.metricsTimer = window.setInterval(() => {
          if (this.status === "connected") {
            this.emitMetrics();
          }
        }, 2000);
      }
    }, 800);
  }

  disconnect() {
    this.stopTimers();
    this.status = "disconnected";
    this.onStatus(this.status);
  }

  ping() {
    this.emitMetrics();
  }

  private emitMetrics() {
    const latency = Math.round(randomBetween(10, 80));
    const per = Number(randomBetween(0, 0.5).toFixed(2));
    this.onMetrics({ latency, per });
  }

  private stopTimers() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }
}
