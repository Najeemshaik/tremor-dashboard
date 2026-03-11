import type { AppState } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { BluetoothServicePort, MockConnectionPort } from "../services/types.js";
import type { ConnectionViewPort } from "./ports.js";
import type { SerialService } from "../services/serial/serialService.js";

export class ConnectionViewModel {
  private store: Store<AppState>;
  private bluetoothService: BluetoothServicePort;
  private mockConnection: MockConnectionPort;
  private connectionView: ConnectionViewPort;
  private serialService: SerialService;

  constructor(options: {
    store: Store<AppState>;
    bluetoothService: BluetoothServicePort;
    mockConnection: MockConnectionPort;
    connectionView: ConnectionViewPort;
    serialService: SerialService;
  }) {
    this.store = options.store;
    this.bluetoothService = options.bluetoothService;
    this.mockConnection = options.mockConnection;
    this.connectionView = options.connectionView;
    this.serialService = options.serialService;
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
      if (this.state.connection.status === "connected") {
        await this.serialService.disconnect();
      } else if (this.state.connection.status === "disconnected") {
        await this.serialService.connect();
      }
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
      // Serial does not support ping — no-op
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
      await this.serialService.disconnect();
    }
    this.store.update((state) => {
      state.connection.mode = nextMode;
      state.connection.status = "disconnected";
      this.bluetoothService.resetConnectionMetrics();
    });
    this.updateView();
  }
}
