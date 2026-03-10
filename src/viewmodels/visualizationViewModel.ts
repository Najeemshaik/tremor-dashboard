import type { AppState, ImuSample, ImuAxis } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { BluetoothServicePort, MockTelemetryPort } from "../services/types.js";
import type { VisualizationViewPort } from "./ports.js";

export class VisualizationViewModel {
  private store: Store<AppState>;
  private mockTelemetry: MockTelemetryPort;
  private bluetoothService: BluetoothServicePort;
  private visualizationView: VisualizationViewPort;
  private sampleCounter = 0;
  private lastSampleRateUpdate = Date.now();
  private lastFreq: number | null = null;

  constructor(options: {
    store: Store<AppState>;
    mockTelemetry: MockTelemetryPort;
    bluetoothService: BluetoothServicePort;
    visualizationView: VisualizationViewPort;
  }) {
    this.store = options.store;
    this.mockTelemetry = options.mockTelemetry;
    this.bluetoothService = options.bluetoothService;
    this.visualizationView = options.visualizationView;
  }

  init() {
    this.visualizationView.setup();
  }

  getSample(delta: number) {
    const state = this.store.getState();
    if (this.bluetoothService.isStreaming()) return null;
    if (state.connection.mode !== "mock" || state.connection.status !== "connected") return null;

    // Reset AR model and clear buffers when frequency changes so old history doesn't bleed through
    if (this.lastFreq !== null && this.lastFreq !== state.params.freq) {
      this.mockTelemetry.reset();
      const axes: ImuAxis[] = ["ax", "ay", "az", "gx", "gy", "gz"];
      for (const axis of axes) {
        state.visualization.axes[axis].length = 0;
      }
    }
    this.lastFreq = state.params.freq;

    const result = this.mockTelemetry.nextSample({ delta, params: state.params });
    this.pushImuSample(result.imu);
    return { sample: result.sample, t: result.t };
  }

  /**
   * Called by the serial service (cable mode) for each incoming IMU line.
   * Routes all 6 axes into their respective buffers and mirrors the
   * selected axis into `buffer` for the chart renderer.
   */
  pushImuSample(imu: ImuSample) {
    const state = this.store.getState();
    if (state.visualization.freeze) return;

    this.sampleCounter++;
    const now = Date.now();
    const elapsed = now - this.lastSampleRateUpdate;
    if (elapsed >= 1000) {
      const rate = Math.round((this.sampleCounter / elapsed) * 1000 * 10) / 10;
      state.visualization.sampleRate = rate;
      this.sampleCounter = 0;
      this.lastSampleRateUpdate = now;
    }

    const axes: ImuAxis[] = ["ax", "ay", "az", "gx", "gy", "gz"];
    const targetLength = Math.max(60, Math.round(state.visualization.sampleRate * state.visualization.windowSeconds));

    for (const axis of axes) {
      state.visualization.axes[axis].push(imu[axis]);
      while (state.visualization.axes[axis].length > targetLength) {
        state.visualization.axes[axis].shift();
      }
    }

    const selected = state.visualization.selectedAxis;
    state.visualization.buffer = state.visualization.axes[selected];
    state.visualization.lastSample = imu[selected];
    state.visualization.t = imu.t;
  }

  setSelectedAxis(axis: ImuAxis) {
    this.store.update((state) => {
      state.visualization.selectedAxis = axis;
      state.visualization.buffer = state.visualization.axes[axis];
    });
  }

  updateChartControls() {
    this.visualizationView.updateChartControls();
  }
}
