import { buildBluetoothRequestOptions, writeCharacteristic } from "./bleUtils.js";
import type { BLE_CONFIG } from "./bleConfig.js";

export type BleTransportOptions = {
  bleConfig: typeof BLE_CONFIG;
  onDisconnect: () => void;
};

export class BleTransport {
  private bleConfig: typeof BLE_CONFIG;
  private onDisconnect: () => void;
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;

  constructor(options: BleTransportOptions) {
    this.bleConfig = options.bleConfig;
    this.onDisconnect = options.onDisconnect;
  }

  getConfig() {
    return this.bleConfig;
  }

  getDevice() {
    return this.device;
  }

  getServer() {
    return this.server;
  }

  async connect() {
    const device = await navigator.bluetooth.requestDevice(
      buildBluetoothRequestOptions(this.bleConfig)
    );
    this.device = device;
    this.device.addEventListener("gattserverdisconnected", this.handleDisconnect);
    this.server = await device.gatt!.connect();
    return this.server;
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.clear();
  }

  async write(characteristic: BluetoothRemoteGATTCharacteristic, payload: Uint8Array) {
    await writeCharacteristic(characteristic, payload);
  }

  clear() {
    if (this.device) {
      this.device.removeEventListener("gattserverdisconnected", this.handleDisconnect);
    }
    this.device = null;
    this.server = null;
  }

  private handleDisconnect = () => {
    this.clear();
    this.onDisconnect();
  };
}
