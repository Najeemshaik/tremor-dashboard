/* global window */

/**
 * RawRecordService — records raw serial lines to a user-selected .txt file.
 *
 * Flow:
 *   1. User calls start(durationSec) — opens a save-file picker, then begins
 *      accepting raw lines via pushLine().
 *   2. Lines are written directly to the writable stream as they arrive.
 *   3. Recording stops automatically after durationSec (0 = unlimited / manual).
 *   4. User (or timer) calls stop() to flush and close the file.
 */

import type { Store } from "../../state/store.js";
import type { AppState } from "../../state/types.js";

type RawRecordCallbacks = {
  onUpdate: () => void;
};

export class RawRecordService {
  private store: Store<AppState>;
  private callbacks: RawRecordCallbacks;

  private writer: FileSystemWritableFileStream | null = null;
  private encoder = new TextEncoder();
  private timerInterval: number | null = null;
  /** Wall-clock time when recording started (ms) */
  private startedAt: number | null = null;
  /** Whether we are currently capturing lines */
  private capturing = false;

  constructor(options: { store: Store<AppState>; callbacks: RawRecordCallbacks }) {
    this.store = options.store;
    this.callbacks = options.callbacks;
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && "showSaveFilePicker" in window;
  }

  /** Called by SerialService.onRawLine for every incoming line. */
  pushLine(line: string): void {
    if (!this.capturing || !this.writer) return;
    void this.writer.write(this.encoder.encode(line + "\n")).catch(() => {
      // If write fails (e.g. disk full) stop gracefully
      void this.stop();
    });
    this.store.update((s) => {
      s.rawRecord.linesWritten += 1;
    });
    this.callbacks.onUpdate();
  }

  async start(durationSec: number): Promise<void> {
    if (this.capturing) return;

    // Open save-file picker
    let fileHandle: FileSystemFileHandle;
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      fileHandle = await (window as Window & typeof globalThis & {
        showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: `tremor-raw-${timestamp}.txt`,
        types: [{ description: "Text file", accept: { "text/plain": [".txt"] } }]
      });
    } catch {
      // User cancelled the dialog — do nothing
      return;
    }

    this.writer = await fileHandle.createWritable();
    this.startedAt = Date.now();
    this.capturing = true;

    this.store.update((s) => {
      s.rawRecord.active = true;
      s.rawRecord.durationSec = durationSec;
      s.rawRecord.remainingSec = durationSec > 0 ? durationSec : null;
      s.rawRecord.linesWritten = 0;
    });
    this.callbacks.onUpdate();

    if (durationSec > 0) {
      // Tick every second to update countdown
      this.timerInterval = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - (this.startedAt ?? Date.now())) / 1000);
        const remaining = Math.max(0, durationSec - elapsed);
        this.store.update((s) => {
          s.rawRecord.remainingSec = remaining;
        });
        this.callbacks.onUpdate();
        if (remaining <= 0) {
          void this.stop();
        }
      }, 1000);
    }
  }

  async stop(): Promise<void> {
    if (!this.capturing) return;
    this.capturing = false;

    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    try {
      await this.writer?.close();
    } catch {
      // ignore close errors
    }
    this.writer = null;
    this.startedAt = null;

    this.store.update((s) => {
      s.rawRecord.active = false;
      s.rawRecord.remainingSec = null;
    });
    this.callbacks.onUpdate();
  }
}
