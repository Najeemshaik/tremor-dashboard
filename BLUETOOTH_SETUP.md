# Bluetooth Setup Guide

This document explains how to enable and use Bluetooth in the Tremor Dashboard.

## 1) Requirements

- Browser:
  - Desktop: Chrome or Edge (recommended).
  - Android: Chrome (Chromium-based browsers may work).
  - iOS: Safari does not support Web Bluetooth.
- Secure context:
  - HTTPS or `http://localhost`.
- Device:
  - BLE peripheral that is advertising.
  - GATT service + characteristics that match the UUIDs configured in the app.

## 2) Device Firmware Expectations

The app expects a BLE GATT service with:
- Control characteristic (write): receives JSON commands.
- Telemetry characteristic (notify, optional): sends samples/metrics.

Default UUIDs live in `src/services/bluetooth/bleConfig.ts` under `BLE_CONFIG`.

Update these constants to match your device:

```js
export const BLE_CONFIG = {
  deviceNamePrefix: "Tremor",
  serviceUUID: "0000fff0-0000-1000-8000-00805f9b34fb",
  controlCharUUID: "0000fff1-0000-1000-8000-00805f9b34fb",
  telemetryCharUUID: "0000fff2-0000-1000-8000-00805f9b34fb"
};
```

## 3) Connection Steps (User Flow)

1. Open the app in a supported browser.
2. Ensure the page is served over HTTPS or `localhost`.
3. Select "Bluetooth" in the Connection Mode dropdown.
4. Click "Connect" and choose your device in the browser prompt.

If your device is not listed:
- Confirm it is advertising.
- Check that `deviceNamePrefix` matches its advertised name.
- Make sure Bluetooth is enabled on the host machine.

## 4) Command Payloads

The dashboard sends JSON commands to the control characteristic:

- Ping:

```json
{ "type": "ping", "ts": 1700000000000 }
```

- Parameter update:

```json
{
  "type": "params",
  "params": {
    "freq": 4.5,
    "amp": 40,
    "noise": 12,
    "enabled": true
  }
}
```

- Stop:

```json
{ "type": "stop" }
```

If your firmware expects a different format, update the JSON in
`src/services/bluetooth/bluetoothService.ts` inside `sendCommand`.

## 5) Telemetry Payloads

The telemetry characteristic (if available) can send:

- JSON:

```json
{ "sample": 12.3, "latency": 25, "per": 0.1 }
```

or:

```json
{ "samples": [12.3, 10.8, 9.9] }
```

- Or a single `float32`/`int16` sample in little-endian format.

Telemetry is parsed in `parseTelemetryValue` in `src/services/bluetooth/bleUtils.ts`.

## 6) Troubleshooting

- "Bluetooth is unavailable" alert:
  - You are not on HTTPS or `localhost`, or the browser lacks Web Bluetooth.
- Connect button does nothing:
  - Your browser blocks Bluetooth prompts (check site permissions).
- Device not found:
  - Ensure the device is advertising and that `deviceNamePrefix` is correct.
- Connected but no data:
  - Confirm the telemetry characteristic UUID and notify property.
  - Verify the firmware sends data in one of the supported formats.

## 7) Notes on Mobile Testing

- Android + Chrome works if the page is HTTPS.
- iOS Safari does not support Web Bluetooth.
