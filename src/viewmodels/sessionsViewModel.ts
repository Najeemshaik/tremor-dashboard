import { createId } from "../core/id.js";
import { nowTimestamp } from "../core/format.js";
import { calculateSummary } from "../core/math.js";
import { showToast } from "../core/toast.js";
import { exportSessionCSV, exportSessionJSON } from "../services/export/exportService.js";
import type { AppState, Session } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { Elements } from "../ui/elements.js";
import type { SessionsViewPort } from "./ports.js";

export class SessionsViewModel {
  private store: Store<AppState>;
  private elements: Elements;
  private sessionsView: SessionsViewPort;
  private persist: () => void;
  private onSessionSaved: (() => void) | undefined;
  private loggingTimer: number | null = null;

  constructor(options: {
    store: Store<AppState>;
    elements: Elements;
    sessionsView: SessionsViewPort;
    persist: () => void;
    onSessionSaved?: () => void;
  }) {
    this.store = options.store;
    this.elements = options.elements;
    this.sessionsView = options.sessionsView;
    this.persist = options.persist;
    this.onSessionSaved = options.onSessionSaved;
  }

  private get state() {
    return this.store.getState();
  }

  renderSessions() {
    this.sessionsView.render(this.state.sessions);
  }

  toggleLogging() {
    this.setLogging(!this.state.logging);
  }

  handleView(id: string) {
    const session = this.findSession(id);
    if (!session) return;
    const avgFreq = this.state.params.freq.toFixed(1);
    this.sessionsView.showSessionModal(session, avgFreq);
  }

  handleDelete(id: string) {
    this.store.update((state) => {
      state.sessions = state.sessions.filter((session) => session.id !== id);
    });
    this.persist();
  }

  handleDeleteConfirm(id: string) {
    this.handleDelete(id);
    this.sessionsView.closeSessionModal();
  }

  handleExportCsv(id: string) {
    const session = this.findSession(id);
    if (session) exportSessionCSV(session);
  }

  handleExportJson(id: string) {
    const session = this.findSession(id);
    if (session) exportSessionJSON(session);
  }

  private setLogging(enabled: boolean) {
    this.store.update((state) => {
      state.logging = enabled;
    });
    this.elements.loggingStatus.textContent = enabled ? "Recording" : "Inactive";
    if (this.elements.recDot) {
      this.elements.recDot.classList.toggle("active", enabled);
    }

    const label = enabled ? "Stop Recording" : "Start Recording";
    const icon = enabled
      ? '<rect x="6" y="6" width="12" height="12" rx="2"/>'
      : '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>';

    const buttonHTML = `
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </svg>
      <span class="btn-text">${label}</span>
    `;

    const sessionsButtonHTML = `
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </svg>
      ${label}
    `;

    this.elements.logToggleBtn.textContent = enabled ? "Stop" : "Start";
    this.elements.sidebarLogBtn.innerHTML = buttonHTML;
    this.elements.sidebarLogBtn.title = label;
    this.elements.sessionsLogBtn.innerHTML = sessionsButtonHTML;

    if (enabled) {
      const startTime = Date.now();
      this.store.update((state) => {
        state.activeSession = {
          id: createId("session"),
          name: `Session ${nowTimestamp()}`,
          start: nowTimestamp(),
          startTime,
          durationSec: 0,
          sampleCount: 0,
          samples: [],
          summary: null
        } as AppState["activeSession"];
      });
      this.startLoggingSampler();
    } else if (this.state.activeSession) {
      this.stopLoggingSampler();
      const endTime = Date.now();
      this.store.update((state) => {
        if (!state.activeSession) return;
        state.activeSession.durationSec = Math.max(
          1,
          Math.round((endTime - state.activeSession.startTime) / 1000)
        );
        state.activeSession.sampleCount = state.activeSession.samples.length;
        state.activeSession.summary = calculateSummary(state.activeSession.samples);
        state.sessions.unshift(state.activeSession);
        state.activeSession = null;
      });
      this.persist();
      showToast("Session saved — tap to view in Sessions", this.onSessionSaved);
    }
  }

  private startLoggingSampler() {
    if (this.loggingTimer) return;
    this.loggingTimer = window.setInterval(() => {
      if (!this.state.activeSession) return;
      const sample = this.state.visualization.lastSample;
      this.store.update((state) => {
        if (!state.activeSession) return;
        state.activeSession.samples.push(sample);
        if (state.activeSession.samples.length > 600) {
          state.activeSession.samples.shift();
        }
      });
    }, 200);
  }

  private stopLoggingSampler() {
    if (this.loggingTimer) {
      clearInterval(this.loggingTimer);
      this.loggingTimer = null;
    }
  }

  /**
   * Parse a .txt CSV file (format: timestamp_ms, ax, ay, az, gx, gy, gz)
   * and import it as a new session using the ay column as the signal.
   */
  async handleImportFile(file: File): Promise<void> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    const samples: number[] = [];
    let tFirst: number | null = null;
    let tLast = 0;

    for (const line of lines) {
      const cols = line.split(",");
      if (cols.length < 7) continue;
      const nums = cols.map((c) => parseFloat(c.trim()));
      if (nums.some((n) => !Number.isFinite(n))) continue;
      const [t, , ay] = nums;
      if (tFirst === null) tFirst = t;
      tLast = t;
      samples.push(ay);
    }

    if (samples.length === 0) {
      window.alert("No valid data found in file. Expected format: timestamp, ax, ay, az, gx, gy, gz");
      return;
    }

    const rawDuration = tLast - (tFirst ?? 0);
    const durationSec = rawDuration > 1000 ? rawDuration / 1000 : rawDuration;
    const summary = calculateSummary(samples);
    const baseName = file.name.replace(/\.[^.]+$/, "");

    const session: Session = {
      id: createId("session"),
      name: baseName,
      start: nowTimestamp(),
      durationSec: Math.max(1, Math.round(durationSec)),
      sampleCount: samples.length,
      samples,
      summary
    };

    this.store.update((state) => {
      state.sessions.unshift(session);
    });
    this.persist();
  }

  private findSession(id: string): Session | undefined {
    return this.state.sessions.find((session) => session.id === id);
  }
}
