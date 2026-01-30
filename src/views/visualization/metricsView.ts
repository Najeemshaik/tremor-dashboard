import { calculateSummary, calculateWindowedRMS } from "../../core/math.js";
import type { AppState } from "../../state/types.js";
import type { Elements } from "../../ui/elements.js";

export class MetricsView {
  private elements: Elements;
  private state: AppState;

  constructor(options: { elements: Elements; state: AppState }) {
    this.elements = options.elements;
    this.state = options.state;
  }

  updateClinicalMetrics() {
    const buffer = this.state.visualization.freezeSpectrum
      ? this.state.visualization.snapshot || this.state.visualization.buffer
      : this.state.visualization.buffer;
    const summary = calculateSummary(buffer);
    const rms = calculateWindowedRMS(buffer, 20);

    this.state.clinicalMetrics.frequency = summary.avg;
    this.state.clinicalMetrics.rms = rms;
    this.state.clinicalMetrics.power = summary.peak;
    this.state.clinicalMetrics.regularity = summary.noise * 100;
    this.state.clinicalMetrics.updrs = summary.noise > 0.5 ? 2 : 1;
    this.state.clinicalMetrics.snr = Math.max(0, 100 - summary.noise * 100);
    this.state.clinicalMetrics.peakToPeak = summary.peak * 2;
    this.state.clinicalMetrics.bandwidth = Math.max(0.2, summary.noise * 0.2);
    this.state.clinicalMetrics.stability = Math.max(0, 100 - summary.noise * 100);
    this.state.clinicalMetrics.harmonic = summary.avg * 10;

    this.updateClinicalMetricsUI();
  }

  updateClinicalMetricsUI() {
    const m = this.state.clinicalMetrics;
    this.elements.metricFrequency.textContent = this.formatNumber(m.frequency, 2);
    this.elements.metricRMS.textContent = this.formatNumber(m.rms, 1);
    this.elements.metricPower.textContent = this.formatNumber(m.power, 1);
    this.elements.metricRegularity.textContent = this.formatNumber(m.regularity, 0);
    this.elements.metricUPDRS.textContent = String(m.updrs);
    this.elements.metricSNR.textContent = this.formatNumber(m.snr, 1);
    this.elements.metricPeakToPeak.textContent = this.formatNumber(m.peakToPeak, 1);
    this.elements.metricBandwidth.textContent = this.formatNumber(m.bandwidth, 2);
    this.elements.metricStability.textContent = this.formatNumber(m.stability, 0);
    this.elements.metricHarmonic.textContent = this.formatNumber(m.harmonic, 0);

    this.updateIndicator(this.elements.freqIndicator, m.frequency, 4, 6, 3, 8);
    this.updateIndicator(this.elements.rmsIndicator, m.rms, 0, 30, 0, 100);
    this.updateIndicator(this.elements.powerIndicator, m.power, -20, 10, -40, 30);
    this.updateIndicator(this.elements.regularityIndicator, m.regularity, 60, 100, 0, 100);
    this.updateIndicator(this.elements.updrsIndicator, m.updrs, 0, 1, 0, 4);
    this.updateIndicator(this.elements.snrIndicator, m.snr, 15, 40, -10, 40);
    this.updateIndicator(this.elements.peakToPeakIndicator, m.peakToPeak, 0, 60, 0, 120);
    this.updateIndicator(this.elements.bandwidthIndicator, m.bandwidth, 0, 2, 0, 6);
    this.updateIndicator(this.elements.stabilityIndicator, m.stability, 70, 100, 0, 100);
    this.updateIndicator(this.elements.harmonicIndicator, m.harmonic, 0, 60, 0, 150);
  }

  private updateIndicator(
    element: HTMLElement,
    value: number,
    normalMin: number,
    normalMax: number,
    alertMin: number,
    alertMax: number
  ) {
    if (!element) return;

    element.classList.remove("normal", "warning", "alert");

    if (value >= normalMin && value <= normalMax) {
      element.classList.add("normal");
    } else if (value < alertMin || value > alertMax) {
      element.classList.add("alert");
    } else {
      element.classList.add("warning");
    }
  }

  private formatNumber(value: number | null | undefined, decimals = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "--";
    }
    return Number(value).toFixed(decimals);
  }
}
