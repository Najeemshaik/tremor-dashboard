import type { AppState } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { BluetoothServicePort, MockTelemetryPort } from "../services/types.js";
import type { VisualizationViewPort } from "./ports.js";

export class VisualizationViewModel {
  private store: Store<AppState>;
  private mockTelemetry: MockTelemetryPort;
  private bluetoothService: BluetoothServicePort;
  private visualizationView: VisualizationViewPort;

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
    return this.mockTelemetry.nextSample({ delta, params: state.params });
  }

  updateChartControls() {
    this.visualizationView.updateChartControls();
  }
}
