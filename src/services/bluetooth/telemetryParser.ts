import { parseTelemetryValue } from "./bleUtils.js";

export type TelemetrySample = {
  samples: number[];
  sample: number | null;
  seq: number | null;
  isPong: boolean;
  ts: number | null;
  latency: number | null;
  per: number | null;
};

export function parseTelemetrySample(event: Event): TelemetrySample | null {
  const target = event.target as BluetoothRemoteGATTCharacteristic;
  const value = target.value;
  if (!value) return null;
  const payload = parseTelemetryValue(value);
  if (!payload) return null;

  const samples = Array.isArray(payload.samples)
    ? payload.samples.filter((sample: number) => Number.isFinite(sample))
    : [];
  const sample = Number.isFinite(payload.sample) ? payload.sample : null;
  const seq = Number.isFinite(payload.seq)
    ? payload.seq
    : Number.isFinite(payload.sequence)
      ? payload.sequence
      : null;
  const isPong = payload.type === "pong" || payload.pong === true;
  const ts = Number.isFinite(payload.ts) ? payload.ts : null;
  const latency = Number.isFinite(payload.latency) ? payload.latency : null;
  const per = Number.isFinite(payload.per) ? payload.per : null;

  return { samples, sample, seq, isPong, ts, latency, per };
}
