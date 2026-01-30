import { calculateSpectrum } from "../../core/math.js";
import type { AppState } from "../../state/types.js";
import type { Elements } from "../../ui/elements.js";

export class SpectrumView {
  private elements: Elements;
  private state: AppState;

  constructor(options: { elements: Elements; state: AppState }) {
    this.elements = options.elements;
    this.state = options.state;
  }

  drawSpectrum() {
    const canvas = this.elements.spectrumCanvas;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = this.state.visualization.buffer;
    const spectrum = calculateSpectrum(data, this.state.visualization.sampleRate);

    const style = getComputedStyle(document.documentElement);
    const chartPrimary = style.getPropertyValue("--chart-primary").trim() || "#0066ff";
    const chartGrid = style.getPropertyValue("--chart-grid").trim() || "rgba(0, 0, 0, 0.1)";
    const chartGridFine = chartGrid.replace(/0\.\d+\)$/, "0.06)") || "rgba(0, 0, 0, 0.06)";
    const align = (value: number) => Math.round(value) + 0.5;

    ctx.strokeStyle = chartGridFine;
    ctx.lineWidth = 1;
    const fineY = 10;
    const fineX = 16;
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
    const majorX = 4;
    for (let i = 0; i <= majorY; i += 1) {
      const y = align((height / majorY) * i);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let i = 0; i <= majorX; i += 1) {
      const x = align((width / majorX) * i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (!spectrum || spectrum.length === 0) return;

    const max = Math.max(...spectrum.map((item) => item.mag), 1);
    const barWidth = width / spectrum.length;
    ctx.fillStyle = `${chartPrimary}AA`;
    spectrum.forEach((item, index) => {
      const x = index * barWidth;
      const barHeight = (item.mag / max) * height * 0.85;
      ctx.fillRect(x, height - barHeight, Math.max(1, barWidth - 1), barHeight);
    });

    if (this.elements.spectrumFreezeBtn) {
      this.elements.spectrumFreezeBtn.textContent = this.state.visualization.freezeSpectrum
        ? "Resume Spectrum"
        : "Freeze Spectrum";
      this.elements.spectrumFreezeBtn.setAttribute(
        "aria-pressed",
        this.state.visualization.freezeSpectrum ? "true" : "false"
      );
    }
  }

  resizeCanvas() {
    const rect = this.elements.spectrumCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.elements.spectrumCanvas.width = rect.width * ratio;
    this.elements.spectrumCanvas.height = rect.height * ratio;
  }
}
