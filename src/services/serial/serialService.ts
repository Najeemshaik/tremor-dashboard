/* global navigator */

/**
 * Web Serial service — reads the 7-column CSV telemetry from the FTDI USB device.
 *
 * Wire format (115200 baud, one line per sample):
 *   timestamp_ms, ax, ay, az, gx, gy, gz
 *
 * Matches the format produced by PD_RecordData_Helpers.py and stored in 3-1.txt.
 */

import type { ImuSample } from "../../state/types.js";

export type SerialStatus = "disconnected" | "connecting" | "connected";

type SerialCallbacks = {
  onStatus: (status: SerialStatus) => void;
  onSample: (sample: ImuSample) => void;
  onError: (message: string) => void;
  onRawLine?: (line: string) => void;
};

export function isSerialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export class SerialService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private status: SerialStatus = "disconnected";
  private stopRequested = false;
  private callbacks: SerialCallbacks;
  private decoder = new TextDecoder("utf-8");
  private lineBuffer = "";
  private tPrev: number | null = null;

  // Baud rate matches PD_RecordData_Helpers.py DEFAULT_BAUD
  static readonly BAUD_RATE = 115200;

  constructor(callbacks: SerialCallbacks) {
    this.callbacks = callbacks;
  }

  isConnected(): boolean {
    return this.status === "connected";
  }

  async connect(): Promise<void> {
    if (this.status !== "disconnected") return;
    this.setStatus("connecting");
    this.stopRequested = false;

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: SerialService.BAUD_RATE });
      this.setStatus("connected");
      this.tPrev = null;
      void this.readLoop();
    } catch (err) {
      this.setStatus("disconnected");
      this.callbacks.onError((err as Error).message ?? "Failed to open serial port");
    }
  }

  async disconnect(): Promise<void> {
    this.stopRequested = true;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
    } catch {
      // ignore
    }
    try {
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {
      // ignore
    }
    this.lineBuffer = "";
    this.setStatus("disconnected");
  }

  private setStatus(status: SerialStatus) {
    this.status = status;
    this.callbacks.onStatus(status);
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;

    this.reader = this.port.readable.getReader();
    try {
      while (!this.stopRequested) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.lineBuffer += this.decoder.decode(value, { stream: true });
          this.flushLines();
        }
      }
    } catch (err) {
      if (!this.stopRequested) {
        this.callbacks.onError((err as Error).message ?? "Serial read error");
      }
    } finally {
      try { this.reader?.releaseLock(); } catch { /* ignore */ }
      this.reader = null;
      if (!this.stopRequested) {
        this.setStatus("disconnected");
      }
    }
  }

  private flushLines() {
    let newline = this.lineBuffer.indexOf("\n");
    while (newline !== -1) {
      const line = this.lineBuffer.slice(0, newline).replace(/\r$/, "").trim();
      this.lineBuffer = this.lineBuffer.slice(newline + 1);
      newline = this.lineBuffer.indexOf("\n");
      if (line.length > 0) {
        this.callbacks.onRawLine?.(line);
        const sample = this.parseLine(line);
        if (sample) this.callbacks.onSample(sample);
      }
    }
  }

  /**
   * Parse one CSV line: timestamp_ms, ax, ay, az, gx, gy, gz
   * Returns null for malformed or header lines.
   */
  private parseLine(line: string): ImuSample | null {
    const cols = line.split(",");
    if (cols.length < 7) return null;
    const nums = cols.map((c) => parseFloat(c.trim()));
    if (nums.some((n) => !Number.isFinite(n))) return null;

    const [tRaw, ax, ay, az, gx, gy, gz] = nums;

    // Normalise timestamp to seconds
    let tSec: number;
    if (this.tPrev === null) {
      tSec = 0;
      this.tPrev = tRaw;
    } else {
      const dtRaw = tRaw - this.tPrev;
      // Auto-detect ms vs s: if dt > 1 it's likely ms
      const dtSec = Math.abs(dtRaw) > 1 ? dtRaw / 1000 : dtRaw;
      tSec = dtSec;
      this.tPrev = tRaw;
    }

    return { t: tSec, ax, ay, az, gx, gy, gz };
  }
}
