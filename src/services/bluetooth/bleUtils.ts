const bleTextEncoder = new TextEncoder();
const bleTextDecoder = new TextDecoder("utf-8");

export type TelemetryPayload = {
  sample?: number;
  samples?: number[];
  seq?: number;
  sequence?: number;
  type?: string;
  pong?: boolean;
  ts?: number;
  latency?: number;
  per?: number;
};

export function isBluetoothAvailable() {
  return Boolean(window.isSecureContext && navigator.bluetooth);
}

export function buildBluetoothRequestOptions(bleConfig: {
  deviceNamePrefix?: string;
  serviceUUID: string;
}): RequestDeviceOptions {
  if (bleConfig.deviceNamePrefix) {
    return {
      filters: [{ namePrefix: bleConfig.deviceNamePrefix } as BluetoothLEScanFilter],
      optionalServices: [bleConfig.serviceUUID]
    };
  }
  return {
    acceptAllDevices: true,
    optionalServices: [bleConfig.serviceUUID]
  };
}

export function parseTelemetryValue(dataView: DataView | null): TelemetryPayload | null {
  if (!dataView) return null;
  const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
  const text = bleTextDecoder.decode(bytes).trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (isTelemetryPayload(parsed)) return parsed;
      return null;
    } catch (error) {
      return null;
    }
  }

  if (dataView.byteLength >= 4) {
    const floatSample = dataView.getFloat32(0, true);
    if (Number.isFinite(floatSample)) {
      return { sample: floatSample };
    }
  }

  if (dataView.byteLength >= 2) {
    return { sample: dataView.getInt16(0, true) };
  }

  return {};
}

export async function writeCharacteristic(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array
) {
  if (characteristic.writeValueWithResponse) {
    await characteristic.writeValueWithResponse(data as BufferSource);
  } else {
    await characteristic.writeValue(data as BufferSource);
  }
}

export function encodeControlPayload(payload: Record<string, unknown>) {
  return bleTextEncoder.encode(JSON.stringify(payload));
}

export function isTelemetryPayload(value: unknown): value is TelemetryPayload {
  return typeof value === "object" && value !== null;
}
