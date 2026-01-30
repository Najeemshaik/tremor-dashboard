import type { Sequence } from "../state/types.js";
import type { LatencyWarningLevel } from "./bluetooth/bluetoothService.js";

export type BluetoothServicePort = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  ping: () => Promise<void>;
  sendCommand: (payload: unknown) => Promise<void>;
  isStreaming: () => boolean;
  toggleLatencyTest: () => void;
  stopLatencyTest: () => void;
  resetConnectionMetrics: () => void;
  isAvailable: () => boolean;
  setLatencyWarning?: (message: string, level: LatencyWarningLevel) => void;
};

export type MockConnectionPort = {
  connect: () => void;
  disconnect: () => void;
  ping: () => void;
};

export type MockTelemetryPort = {
  nextSample: (input: { delta: number; params: { freq: number; amp: number; noise: number; enabled: boolean } }) => {
    t: number;
    sample: number;
  };
  reset: () => void;
};

export type StoragePort = {
  load: () => unknown;
  save: (payload: unknown) => void;
};

export type SequencePayload = {
  id: string;
  name: string;
  steps: Sequence["steps"];
};
