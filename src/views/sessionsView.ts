import { formatDuration, formatNumber } from "../core/format.js";
import type { Session } from "../state/types.js";
import type { Elements } from "../ui/elements.js";
import type { ModalManager } from "./modalManager.js";

export class SessionsView {
  private elements: Elements;
  private modalManager: ModalManager;
  private onView: (id: string) => void;
  private onDelete: (id: string) => void;
  private onDeleteConfirm: (id: string) => void;
  private onExportCsv: (id: string) => void;
  private onExportJson: (id: string) => void;

  constructor(options: {
    elements: Elements;
    modalManager: ModalManager;
    onView: (id: string) => void;
    onDelete: (id: string) => void;
    onDeleteConfirm: (id: string) => void;
    onExportCsv: (id: string) => void;
    onExportJson: (id: string) => void;
  }) {
    this.elements = options.elements;
    this.modalManager = options.modalManager;
    this.onView = options.onView;
    this.onDelete = options.onDelete;
    this.onDeleteConfirm = options.onDeleteConfirm;
    this.onExportCsv = options.onExportCsv;
    this.onExportJson = options.onExportJson;
  }

  render(sessions: Session[]) {
    this.elements.sessionsTable.innerHTML = "";
    if (sessions.length === 0) {
      this.elements.sessionsEmpty.classList.remove("hidden");
      return;
    }
    this.elements.sessionsEmpty.classList.add("hidden");

    sessions.forEach((session) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <th scope="row"><strong>${session.name}</strong></th>
        <td>${session.start}</td>
        <td><span style="font-family: var(--font-mono)">${formatDuration(session.durationSec)}</span></td>
        <td><span style="font-family: var(--font-mono)">${session.sampleCount}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary" data-action="view" data-id="${session.id}" aria-label="View session ${session.name}">View</button>
            <button class="btn btn-danger" data-action="delete" data-id="${session.id}" aria-label="Delete session ${session.name}">Delete</button>
          </div>
        </td>
      `;
      this.elements.sessionsTable.appendChild(row);
    });
  }

  bindEvents() {
    this.elements.sessionsTable.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;
      if (action === "view") {
        this.onView(id);
      }
      if (action === "delete") {
        this.onDelete(id);
      }
    });

    this.elements.deleteSessionBtn.addEventListener("click", () => {
      if (!this.elements.deleteSessionBtn.dataset.id) return;
      const id = this.elements.deleteSessionBtn.dataset.id;
      this.onDeleteConfirm(id);
    });

    this.elements.exportCsvBtn.addEventListener("click", () => {
      const id = this.elements.deleteSessionBtn.dataset.id;
      if (id) this.onExportCsv(id);
    });

    this.elements.exportJsonBtn.addEventListener("click", () => {
      const id = this.elements.deleteSessionBtn.dataset.id;
      if (id) this.onExportJson(id);
    });
  }

  showSessionModal(session: Session, avgFreq: string) {
    this.elements.sessionSummary.innerHTML = `
      <div class="summary-card">
        <span>Duration</span>
        <strong>${formatDuration(session.durationSec)}</strong>
      </div>
      <div class="summary-card">
        <span>Samples</span>
        <strong>${session.sampleCount}</strong>
      </div>
      <div class="summary-card">
        <span>RMS Amplitude</span>
        <strong>${formatNumber(session.summary.rms, 1)}</strong>
      </div>
      <div class="summary-card">
        <span>Peak Value</span>
        <strong>${formatNumber(session.summary.peak, 1)}</strong>
      </div>
      <div class="summary-card">
        <span>Avg Frequency</span>
        <strong>${avgFreq} Hz</strong>
      </div>
      <div class="summary-card">
        <span>Noise Level</span>
        <strong>${formatNumber(session.summary.noise, 1)}</strong>
      </div>
    `;
    this.elements.deleteSessionBtn.dataset.id = session.id;
    this.modalManager.open(this.elements.sessionModal);

    setTimeout(() => this.drawSessionChart(session.samples), 50);
  }

  closeSessionModal() {
    this.modalManager.close(this.elements.sessionModal);
  }

  private drawSessionChart(samples: number[]) {
    const canvas = this.elements.sessionCanvas as HTMLCanvasElement;
    this.resizeCanvas(canvas);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const style = getComputedStyle(document.documentElement);
    const chartSecondary = style.getPropertyValue("--chart-secondary").trim() || "#0891b2";

    ctx.fillStyle = `${chartSecondary}10`;
    ctx.fillRect(0, 0, width, height);

    if (!samples || samples.length === 0) return;

    const mid = height / 2;
    const scale = (height * 0.35) / 100;

    ctx.shadowColor = chartSecondary;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = chartSecondary;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    samples.forEach((value, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = mid - value * scale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  private resizeCanvas(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
  }
}
