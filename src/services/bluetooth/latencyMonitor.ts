import type { ConnectionState } from "../../state/types.js";
import { LATENCY_ALERT_MS, LATENCY_WARNING_MS } from "../../core/constants.js";
import { getLatencyWarning, type LatencyWarningLevel } from "./bluetoothService.js";

export class LatencyMonitor {
  private state: ConnectionState;
  private onLatencyWarning: (message: string, level: LatencyWarningLevel) => void;

  constructor(options: {
    state: ConnectionState;
    onLatencyWarning: (message: string, level: LatencyWarningLevel) => void;
  }) {
    this.state = options.state;
    this.onLatencyWarning = options.onLatencyWarning;
  }

  updateLatency(latency: number | null) {
    if (latency === null) {
      const { message, level } = getLatencyWarning(latency, false);
      this.onLatencyWarning(message, level);
      return;
    }
    if (latency >= LATENCY_ALERT_MS) {
      const { message, level } = getLatencyWarning(latency, true);
      this.onLatencyWarning(message, level);
      return;
    }
    if (latency >= LATENCY_WARNING_MS) {
      const { message, level } = getLatencyWarning(latency, true);
      this.onLatencyWarning(message, level);
      return;
    }
    this.onLatencyWarning("", "hidden");
  }
}
