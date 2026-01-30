import type { AppState } from "../../state/types.js";
import type { Elements } from "../../ui/elements.js";

export class ChartView {
  private elements: Elements;
  private state: AppState;

  constructor(options: { elements: Elements; state: AppState }) {
    this.elements = options.elements;
    this.state = options.state;
  }

  updateSignal(delta: number, sample: number, t?: number) {
    if (typeof t === "number") {
      this.state.visualization.t = t;
    } else {
      this.state.visualization.t += delta;
    }
    this.state.visualization.lastSample = sample;
    this.state.visualization.buffer.push(sample);
    const targetLength = this.getTargetBufferLength();
    while (this.state.visualization.buffer.length > targetLength) {
      this.state.visualization.buffer.shift();
    }
  }

  updateChartControls() {
    if (this.elements.windowRange) {
      this.elements.windowRange.value = String(this.state.visualization.windowSeconds);
    }
    if (this.elements.windowValue) {
      this.elements.windowValue.textContent = `${this.state.visualization.windowSeconds.toFixed(1)}s`;
    }
    if (this.elements.gainRange) {
      this.elements.gainRange.value = String(this.state.visualization.gain.toFixed(1));
    }
    if (this.elements.gainValue) {
      this.elements.gainValue.textContent = `${this.state.visualization.gain.toFixed(1)}x`;
    }
    if (this.elements.snapshotBtn) {
      this.elements.snapshotBtn.textContent = this.state.visualization.snapshot
        ? "Clear Snapshot"
        : "Capture Snapshot";
    }
  }

  drawChart() {
    const canvas = this.elements.tremorCanvas;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const style = getComputedStyle(document.documentElement);
    const chartPrimary = style.getPropertyValue("--chart-primary").trim() || "#0066ff";
    const chartSecondary = style.getPropertyValue("--chart-secondary").trim() || "#0891b2";
    const chartGrid = style.getPropertyValue("--chart-grid").trim() || "rgba(0, 0, 0, 0.1)";
    const chartGridStrong = chartGrid.replace(/0\.\d+\)$/, "0.2)") || "rgba(0, 0, 0, 0.2)";
    const chartGridFine = chartGrid.replace(/0\.\d+\)$/, "0.06)") || "rgba(0, 0, 0, 0.06)";
    const align = (value: number) => Math.round(value) + 0.5;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `${chartPrimary}15`);
    gradient.addColorStop(1, `${chartSecondary}08`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = chartGridFine;
    ctx.lineWidth = 1;
    const fineY = 16;
    const fineX = 20;
    for (let i = 0; i <= fineY; i += 1) {
      const y = align((height / fineY) * i);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let i = 0; i <= fineX; i += 1) {
      const x = align((width / fineX) * i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.strokeStyle = chartGrid;
    ctx.lineWidth = 1.2;

    const majorY = 4;
    const majorX = 6;
    for (let i = 0; i <= majorY; i++) {
      const y = align((height / majorY) * i);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let i = 0; i <= majorX; i++) {
      const x = align((width / majorX) * i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.strokeStyle = chartGridStrong;
    ctx.lineWidth = 2.2;
    const mid = height / 2;
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    const midY = align(mid);
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    const data = this.state.visualization.buffer;
    let maxAbs = 100;
    if (this.state.visualization.autoScale && data.length > 0) {
      maxAbs = data.reduce((max, value) => Math.max(max, Math.abs(value)), 1);
    }
    let scale = (height * 0.35) / maxAbs;
    scale *= this.state.visualization.gain;

    ctx.shadowColor = chartPrimary;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = chartPrimary;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = mid - value * scale;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    if (this.state.visualization.snapshot && this.state.visualization.snapshot.length > 1) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = chartSecondary;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      this.state.visualization.snapshot.forEach((value, index) => {
        const x = (index / (this.state.visualization.snapshot!.length - 1)) * width;
        const y = mid - value * scale;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;

    if (this.state.visualization.mouseX !== null) {
      const mouseX = this.state.visualization.mouseX;
      const ratio = window.devicePixelRatio || 1;
      const canvasX = mouseX * ratio;
      const index = Math.floor((canvasX / width) * data.length);

      if (index >= 0 && index < data.length) {
        const x = (index / (data.length - 1)) * width;
        const y = mid - data[index] * scale;

        ctx.strokeStyle = chartGridStrong;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = chartPrimary;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  resizeCanvas() {
    const rect = this.elements.tremorCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.elements.tremorCanvas.width = rect.width * ratio;
    this.elements.tremorCanvas.height = rect.height * ratio;
  }

  private getTargetBufferLength() {
    const length = Math.round(this.state.visualization.sampleRate * this.state.visualization.windowSeconds);
    return Math.max(60, length);
  }
}
