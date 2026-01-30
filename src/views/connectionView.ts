import { getLatencyWarning, type BluetoothService } from "../services/bluetooth/bluetoothService.js";
import type { AppState } from "../state/types.js";
import type { Elements } from "../ui/elements.js";

export class ConnectionView {
  private elements: Elements;
  private state: AppState;
  private bluetoothService: BluetoothService;

  constructor(options: {
    elements: Elements;
    state: AppState;
    bluetoothService: BluetoothService;
  }) {
    this.elements = options.elements;
    this.state = options.state;
    this.bluetoothService = options.bluetoothService;
  }

  update() {
    const status = this.state.connection.status;
    this.elements.connectionStatusPill.textContent = this.capitalize(status);
    this.elements.connectionStatusPill.dataset.status = status;
    this.elements.topStatusPill.textContent = this.capitalize(status);
    this.elements.topStatusPill.dataset.status = status;

    this.elements.sidebarStatusText.textContent = this.capitalize(status);
    this.elements.sidebarStatusDot.className = `status-dot ${status}`;

    const buttonText = status === "connected" ? "Disconnect" : "Connect";
    this.elements.connectBtn.innerHTML = `
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${status === "connected"
          ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
          : '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>'
        }
      </svg>
      ${buttonText}
    `;
    this.elements.connectBtn.disabled = status === "connecting";

    const latency = this.state.connection.latency;
    const per = this.state.connection.per;
    this.elements.latencyValue.textContent = this.formatNumber(latency, 0);
    this.elements.perValue.textContent = this.formatNumber(per, 2);
    this.elements.topLatency.textContent = this.formatNumber(latency, 0);
    this.elements.topPer.textContent = this.formatNumber(per, 2);

    if (this.elements.healthMode) {
      if (this.state.connection.mode === "mock") {
        this.elements.healthMode.textContent = "Simulation";
      } else if (this.state.connection.mode === "cable") {
        this.elements.healthMode.textContent = "USB Cable (Stub)";
      } else {
        this.elements.healthMode.textContent = this.capitalize(this.state.connection.mode);
      }
    }

    this.updateLatencyTestUI();
    this.updateLatencyWarning();
    this.updateDeviceSyncUI();
  }

  updateBluetoothOptionState() {
    const option = this.elements.connectionMode?.querySelector(
      'option[value="bluetooth"]'
    ) as HTMLOptionElement | null;
    if (!option) return;
    if (!this.bluetoothService.isAvailable()) {
      option.disabled = true;
      option.textContent = "Bluetooth (Unavailable)";
      if (this.elements.connectionMode.value === "bluetooth") {
        this.elements.connectionMode.value = "mock";
        this.state.connection.mode = "mock";
      }
    } else {
      option.disabled = false;
      option.textContent = "Bluetooth";
    }
  }

  setLatencyWarning(message: string, level: "hidden" | "warning" | "alert") {
    if (!this.elements.latencyWarning) return;
    if (level === "hidden") {
      this.elements.latencyWarning.classList.add("hidden");
      this.elements.latencyWarning.classList.remove("alert-text");
      this.elements.latencyWarning.classList.add("warning-text");
      return;
    }
    this.elements.latencyWarning.textContent = message;
    this.elements.latencyWarning.classList.remove("hidden");
    if (level === "alert") {
      this.elements.latencyWarning.classList.remove("warning-text");
      this.elements.latencyWarning.classList.add("alert-text");
    } else {
      this.elements.latencyWarning.classList.remove("alert-text");
      this.elements.latencyWarning.classList.add("warning-text");
    }
  }

  updateLatencyWarning() {
    const latency = this.state.connection.latency;
    const isConnected = this.state.connection.status === "connected";
    const { message, level } = getLatencyWarning(latency, isConnected);
    this.setLatencyWarning(message, level);
  }

  updateLatencyTestUI() {
    if (!this.elements.latencyTestBtn) return;
    const canTest =
      this.state.connection.mode === "bluetooth" &&
      this.state.connection.status === "connected" &&
      this.bluetoothService.isAvailable();
    this.elements.latencyTestBtn.disabled = !canTest;
    this.elements.latencyTestBtn.textContent = this.state.connection.latencyTest.active
      ? "Stop Latency Test"
      : "Start Latency Test";
  }

  updateDeviceSyncUI() {
    if (!this.elements.sequenceEditor) return;
    const disabled =
      this.state.connection.mode !== "bluetooth" || this.state.connection.status !== "connected";
    this.elements.sequenceEditor
      .querySelectorAll('[data-action="device-sync"], [data-action="device-play"], [data-action="device-stop"]')
      .forEach((button: HTMLButtonElement) => {
        button.disabled = disabled;
      });
  }

  private formatNumber(value: number | null | undefined, decimals = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "--";
    }
    return Number(value).toFixed(decimals);
  }

  private capitalize(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
