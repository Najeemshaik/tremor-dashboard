import type { AppState } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { BluetoothServicePort } from "../services/types.js";

type NumericParamKey = "freq" | "amp" | "noise";

export class ParamsViewModel {
  private store: Store<AppState>;
  private bluetoothService: BluetoothServicePort;
  private updateParamUI: () => void;
  private updateLastSentUI: () => void;

  constructor(options: {
    store: Store<AppState>;
    bluetoothService: BluetoothServicePort;
    updateParamUI: () => void;
    updateLastSentUI: () => void;
  }) {
    this.store = options.store;
    this.bluetoothService = options.bluetoothService;
    this.updateParamUI = options.updateParamUI;
    this.updateLastSentUI = options.updateLastSentUI;
  }

  private get state() {
    return this.store.getState();
  }

  handleParamChange(key: NumericParamKey, value: number) {
    const clamped = this.clampParam(key, value);
    this.store.update((state) => {
      state.params[key] = clamped;
    });
    this.updateParamUI();
  }

  handleSend() {
    this.store.update((state) => {
      state.lastSent = { ...state.params };
      const now = new Date();
      state.lastSentAt = now.toISOString().slice(0, 19).replace("T", " ");
    });
    this.updateParamUI();
    this.updateLastSentUI();
    void this.bluetoothService.sendCommand({ type: "params", params: { ...this.state.params } });
  }

  handleStop() {
    this.store.update((state) => {
      state.params.enabled = false;
      state.params.amp = 0;
    });
    this.updateParamUI();
    void this.bluetoothService.sendCommand({ type: "stop" });
  }

  private clampParam(key: NumericParamKey, value: number) {
    if (key === "freq") {
      return Math.min(12, Math.max(4, Math.round(value)));
    }
    if (key === "amp") {
      return Math.min(100, Math.max(0, value));
    }
    if (key === "noise") {
      return Math.min(100, Math.max(0, value));
    }
    return value;
  }
}
