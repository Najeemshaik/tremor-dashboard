import type { AppState } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { BluetoothServicePort, MockConnectionPort } from "../services/types.js";
import type { ConnectionViewPort } from "./ports.js";

export class ConnectionViewModel {
  private store: Store<AppState>;
  private bluetoothService: BluetoothServicePort;
  private mockConnection: MockConnectionPort;
  private connectionView: ConnectionViewPort;

  constructor(options: {
    store: Store<AppState>;
    bluetoothService: BluetoothServicePort;
    mockConnection: MockConnectionPort;
    connectionView: ConnectionViewPort;
  }) {
    this.store = options.store;
    this.bluetoothService = options.bluetoothService;
    this.mockConnection = options.mockConnection;
    this.connectionView = options.connectionView;
  }

  private get state() {
    return this.store.getState();
  }

  updateView() {
    this.connectionView.update();
  }

  updateBluetoothOptionState() {
    this.connectionView.updateBluetoothOptionState();
  }

  async handleConnectClick() {
    if (this.state.connection.mode === "bluetooth") {
      if (this.state.connection.status === "connected") {
        await this.bluetoothService.disconnect();
        return;
      }
      if (this.state.connection.status === "connecting") return;
      await this.bluetoothService.connect();
      return;
    }
    if (this.state.connection.mode === "cable") {
      window.alert("USB Cable mode is a stub. Connect logic is not implemented yet.");
      this.store.update((state) => {
        state.connection.status = "disconnected";
        this.bluetoothService.resetConnectionMetrics();
      });
      this.updateView();
      return;
    }

    if (this.state.connection.status === "connected") {
      this.mockConnection.disconnect();
      return;
    }
    if (this.state.connection.status === "connecting") {
      return;
    }
    this.mockConnection.connect();
  }

  async handlePingClick() {
    if (this.state.connection.mode === "bluetooth") {
      await this.bluetoothService.ping();
      return;
    }
    if (this.state.connection.mode === "cable") {
      window.alert("USB Cable mode is a stub. Ping is not available.");
      return;
    }
    this.mockConnection.ping();
  }

  async handleConnectionModeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const nextMode = target.value as AppState["connection"]["mode"];
    this.bluetoothService.stopLatencyTest();
    if (this.state.connection.mode === "bluetooth") {
      await this.bluetoothService.disconnect();
    } else if (this.state.connection.mode === "mock") {
      this.mockConnection.disconnect();
    } else if (this.state.connection.mode === "cable") {
      this.store.update((state) => {
        state.connection.status = "disconnected";
        this.bluetoothService.resetConnectionMetrics();
      });
      this.updateView();
    }
    this.store.update((state) => {
      state.connection.mode = nextMode;
      state.connection.status = "disconnected";
      this.bluetoothService.resetConnectionMetrics();
    });
    this.updateView();
  }
}
