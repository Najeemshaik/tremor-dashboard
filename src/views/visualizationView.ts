import type { AppState } from "../state/types.js";
import type { Elements } from "../ui/elements.js";
import { ChartView } from "./visualization/chartView.js";
import { SpectrumView } from "./visualization/spectrumView.js";
import { MetricsView } from "./visualization/metricsView.js";

type SampleResult = { sample: number; t?: number } | null;

export class VisualizationView {
  private elements: Elements;
  private state: AppState;
  private getSample?: (delta: number) => SampleResult;
  private chartView: ChartView;
  private spectrumView: SpectrumView;
  private metricsView: MetricsView;
  private lastFrame: number | null = null;

  constructor(options: {
    elements: Elements;
    state: AppState;
    getSample?: (delta: number) => SampleResult;
  }) {
    this.elements = options.elements;
    this.state = options.state;
    this.getSample = options.getSample;
    this.chartView = new ChartView({ elements: options.elements, state: options.state });
    this.spectrumView = new SpectrumView({ elements: options.elements, state: options.state });
    this.metricsView = new MetricsView({ elements: options.elements, state: options.state });
  }

  setup() {
    this.chartView.resizeCanvas();
    this.spectrumView.resizeCanvas();
    window.addEventListener("resize", () => {
      this.chartView.resizeCanvas();
      this.spectrumView.resizeCanvas();
    });

    const chartContainer = this.elements.chartContainer;
    if (chartContainer) {
      chartContainer.addEventListener("mousemove", (event: MouseEvent) => {
        this.handleChartMouseMove(event);
      });
      chartContainer.addEventListener("mouseleave", () => this.handleChartMouseLeave());
      chartContainer.addEventListener("focus", () => this.handleChartFocus());
      chartContainer.addEventListener("blur", () => this.handleChartBlur());
      chartContainer.addEventListener("keydown", (event: KeyboardEvent) => {
        this.handleChartKeydown(event);
      });
    }

    requestAnimationFrame((ts) => this.animate(ts));
    window.setInterval(() => this.metricsView.updateClinicalMetrics(), 500);
  }

  updateSignal(delta: number, sample: number, t?: number) {
    this.chartView.updateSignal(delta, sample, t);
  }

  updateChartControls() {
    this.chartView.updateChartControls();
  }

  private animate(timestamp: number) {
    if (!this.lastFrame) this.lastFrame = timestamp;
    const delta = (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;
    if (delta > 0) {
      const instantRate = 1 / delta;
      this.state.visualization.sampleRate =
        this.state.visualization.sampleRate * 0.9 + instantRate * 0.1;
    }
    if (this.elements.sampleRateValue) {
      this.elements.sampleRateValue.textContent = this.formatNumber(
        this.state.visualization.sampleRate,
        1
      );
    }
    if (!this.state.visualization.freeze && this.getSample) {
      const result = this.getSample(delta);
      if (result) {
        this.updateSignal(delta, result.sample, result.t);
      }
    }
    this.chartView.drawChart();
    if (!this.state.visualization.freezeSpectrum) {
      this.spectrumView.drawSpectrum();
    }
    requestAnimationFrame((ts) => this.animate(ts));
  }

  private handleChartMouseMove(event: MouseEvent) {
    const chartContainer = this.elements.chartContainer;
    if (!chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.state.visualization.usingKeyboard = false;
    this.state.visualization.mouseX = x;
    this.state.visualization.mouseY = y;

    const index = Math.floor((x / rect.width) * this.state.visualization.buffer.length);
    this.showChartTooltip(index, x, y, rect);
  }

  private handleChartMouseLeave() {
    if (this.state.visualization.usingKeyboard) return;
    this.clearChartSelection();
  }

  private handleChartFocus() {
    this.state.visualization.usingKeyboard = true;
    const chartContainer = this.elements.chartContainer;
    if (!chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();
    const data = this.state.visualization.buffer;
    const midIndex = Math.floor(data.length / 2);
    this.state.visualization.keyboardIndex = midIndex;
    this.showChartTooltip(midIndex, null, null, rect);
  }

  private handleChartBlur() {
    this.clearChartSelection();
  }

  private handleChartKeydown(event: KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"];
    if (!keys.includes(event.key)) return;
    const data = this.state.visualization.buffer;
    if (!data.length) return;
    const chartContainer = this.elements.chartContainer;
    if (!chartContainer) return;
    const rect = chartContainer.getBoundingClientRect();

    if (event.key === "Escape") {
      this.clearChartSelection();
      return;
    }

    let index = this.state.visualization.keyboardIndex ?? Math.floor(data.length / 2);

    if (event.key === "ArrowLeft") index -= 1;
    if (event.key === "ArrowRight") index += 1;
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = data.length - 1;

    index = Math.max(0, Math.min(data.length - 1, index));
    this.state.visualization.keyboardIndex = index;
    this.showChartTooltip(index, null, null, rect);
  }

  private showChartTooltip(index: number, x: number | null, y: number | null, rect: DOMRect) {
    const data = this.state.visualization.buffer;
    if (!data.length) return;
    const value = data[index];
    const timeSeconds = this.state.visualization.windowSeconds * (index / data.length);
    const amplitude = this.formatNumber(value, 2);

    const tooltip = this.elements.chartTooltip;
    if (!tooltip) return;
    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");

    const posX = x ?? (rect.width * index) / data.length;
    const posY = y ?? rect.height / 2;
    tooltip.style.left = `${posX + 12}px`;
    tooltip.style.top = `${posY - 12}px`;
    tooltip.innerHTML = `
      <strong>${amplitude}</strong>
      <div>${timeSeconds.toFixed(2)}s</div>
    `;

    if (this.elements.chartLive) {
      this.elements.chartLive.textContent = `Amplitude ${amplitude}, time ${timeSeconds.toFixed(
        2
      )} seconds.`;
    }
  }

  private clearChartSelection() {
    this.state.visualization.mouseX = null;
    this.state.visualization.mouseY = null;
    this.state.visualization.keyboardIndex = null;
    if (this.elements.chartTooltip) {
      this.elements.chartTooltip.classList.remove("visible");
      this.elements.chartTooltip.setAttribute("aria-hidden", "true");
    }
    if (this.elements.chartLive) {
      this.elements.chartLive.textContent = "";
    }
  }

  private formatNumber(value: number | null | undefined, decimals = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "--";
    }
    return Number(value).toFixed(decimals);
  }
}
