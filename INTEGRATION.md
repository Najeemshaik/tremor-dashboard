# Hardware Integration Guide

This document is for embedded engineers integrating a physical wearable board with the Tremor Dashboard.
It describes every configuration point, expected wire formats, and exactly which files to edit.

---

## Quick Reference

| What you need to change | File | Section |
|---|---|---|
| BLE service / characteristic UUIDs | `src/services/bluetooth/bleConfig.ts` | [BLE Configuration](#ble-configuration) |
| BLE device name filter | `src/services/bluetooth/bleConfig.ts` | [BLE Configuration](#ble-configuration) |
| Serial baud rate | `src/services/serial/serialService.ts` | [Serial Configuration](#serial-configuration) |
| CSV column order / field mapping | `src/services/serial/serialService.ts` | [Serial Payload Format](#serial-payload-format) |
| BLE telemetry payload shape | `src/services/bluetooth/bleUtils.ts` | [BLE Telemetry Payload](#ble-telemetry-payload) |
| Outgoing stimulation command format | `src/services/bluetooth/bleUtils.ts` | [BLE Outgoing Commands](#ble-outgoing-commands) |
| Stimulation parameter ranges | `src/viewmodels/paramsViewModel.ts` | [Parameter Ranges](#parameter-ranges) |

---

## Serial (USB Cable) Integration

### Serial Configuration

**File:** `src/services/serial/serialService.ts`

```ts
// Line ~30 — change baud rate here
const port = await (navigator.serial as SerialPort).open({ baudRate: 115200 });
```

Change `115200` to match your firmware's UART baud rate.

---

### Serial Payload Format

**File:** `src/services/serial/serialService.ts` — `flushLines()` method

The dashboard expects **newline-delimited (`\n`) CSV** with exactly **7 columns**:

```
timestamp, ax, ay, az, gx, gy, gz
```

| Column | Field | Unit | Notes |
|---|---|---|---|
| 0 | `timestamp` | ms or s | Auto-detected: if delta > 1 assumes ms, divides by 1000 |
| 1 | `ax` | g or raw | Accelerometer X |
| 2 | `ay` | g or raw | Accelerometer Y — **this is the primary display axis** |
| 3 | `az` | g or raw | Accelerometer Z |
| 4 | `gx` | deg/s or raw | Gyroscope X |
| 5 | `gy` | deg/s or raw | Gyroscope Y |
| 6 | `gz` | deg/s or raw | Gyroscope Z |

**Example line your firmware should emit:**
```
1712345678123,0.25,0.31,9.80,-0.01,0.02,0.00\n
```

**Validation rules applied by the parser:**
- Line must split into ≥ 7 comma-separated tokens
- All tokens must be finite numbers (`Number.isFinite`)
- Lines that fail are silently skipped

**If your column order differs**, edit the destructuring in `flushLines()`:

```ts
// src/services/serial/serialService.ts  ~line 90
const [tRaw, ax, ay, az, gx, gy, gz] = cols.map(Number);
//      ^ col 0  1   2   3   4   5   6
```

Reorder to match your firmware output.

---

### Serial — No Outgoing Commands

The serial path is currently **receive-only**. The dashboard does not write stimulation parameters over USB.
If you need bidirectional serial control, add a write path in `SerialService` and wire it analogously to
`bluetoothService.sendCommand()`.

---

## Bluetooth (BLE) Integration

### BLE Configuration

**File:** `src/services/bluetooth/bleConfig.ts`

```ts
export const BLE_CONFIG = {
  serviceUUID:       "0000fff0-0000-1000-8000-00805f9b34fb",
  controlCharUUID:   "0000fff1-0000-1000-8000-00805f9b34fb",
  telemetryCharUUID: "0000fff2-0000-1000-8000-00805f9b34fb",
  namePrefix:        undefined,   // set to e.g. "Tremor" to filter by name
  acceptAllDevices:  true,
};
```

Replace the three UUIDs with the ones programmed into your GATT server.
Set `namePrefix` to your device's advertised name prefix (and set `acceptAllDevices: false`) so the
browser picker only shows your board.

---

### BLE Telemetry Payload

**File:** `src/services/bluetooth/bleUtils.ts` — `parseTelemetrySample()`

The dashboard accepts **two formats** on the telemetry characteristic (`fff2`):

#### Option A — JSON (recommended for debugging)

Send a UTF-8 JSON object. Recognised fields:

```jsonc
{
  "sample":   0.31,        // single float — used as the waveform value
  "samples":  [0.31, ...], // array of floats — batch mode
  "seq":      42,          // packet sequence number (enables PER tracking)
  "sequence": 42,          // alias for seq
  "ts":       1712345678,  // device timestamp ms (enables latency measurement)
  "latency":  12,          // device-computed latency ms (alternative)
  "per":      0.5,         // device-computed PER % (alternative)
  "pong":     true,        // echo response to a ping command
  "type":     "pong"       // alternative pong indicator
}
```

Only the fields you include are used — the rest are ignored.

For a minimal IMU-style implementation that populates all six axes, emit a JSON object that maps to the
`ImuSample` shape the chart understands. **The current JSON path only reads `sample` / `samples` (scalar
or array), not individual axis fields.** If you want all 6 axes over BLE, either:

- Pack them as a 6-float array in `samples`, **or**
- Extend `parseTelemetrySample()` in `bleUtils.ts` to read `ax`, `ay`, etc. from JSON, and call
  `visualizationViewModel.pushImuSample(imu)` instead of `visualizationView.updateSignal()` — matching
  the serial path.

#### Option B — Binary

If JSON is too expensive, send raw binary on the characteristic:

| Byte width | Interpretation |
|---|---|
| ≥ 4 bytes | `Float32LE` at offset 0 → `sample` |
| 2–3 bytes | `Int16LE` at offset 0 → `sample` |

To send 6 axes as binary, extend `parseTelemetrySample()` to read 6 consecutive `Float32LE` values
(24 bytes total) and construct a full `ImuSample`.

---

### BLE Outgoing Commands

**File:** `src/services/bluetooth/bleUtils.ts` — `encodeControlPayload()`

Commands are sent to the control characteristic (`fff1`) as UTF-8-encoded JSON.

#### Stimulation parameters (sent on "Apply Parameters"):
```jsonc
{
  "type":   "params",
  "freq":   6,      // Hz  — integer, range 4–12
  "amp":    70,     // RU  — 0–100
  "noise":  12,     // %   — 0–100
  "enabled": true
}
```

#### Stop stimulation:
```jsonc
{ "type": "stop" }
```

#### Latency ping (sent automatically every second during latency test):
```jsonc
{ "type": "ping", "ts": 1712345678123, "seq": 7 }
```

Your firmware should echo the ping back on the telemetry characteristic with `{ "pong": true, "ts": <same ts>, "seq": <same seq> }`.

---

### Parameter Ranges

**File:** `src/viewmodels/paramsViewModel.ts` — `clampParam()`

```ts
freq:  4–12 Hz   (integer steps)
amp:   0–100
noise: 0–100
```

Change the clamp values here to match your hardware's actual safe operating range.
The HTML slider `min`/`max` attributes in `index.html` should be updated to match.

---

## ImuSample Type Contract

**File:** `src/state/types.ts`

All internal signal routing uses this shape:

```ts
type ImuSample = {
  t:  number;  // time in seconds (delta from session start, or absolute)
  ax: number;  // acceleration X
  ay: number;  // acceleration Y  ← default display axis
  az: number;  // acceleration Z
  gx: number;  // gyroscope X
  gy: number;  // gyroscope Y
  gz: number;  // gyroscope Z
};
```

Units are not enforced — the chart auto-scales. Consistent units within a session are all that matters
for the clinical metrics to be meaningful.

---

## Clinical Metrics Reference

These metrics are computed entirely in the dashboard from the incoming signal — the firmware does not need
to calculate them. They are displayed live and stored with each session.

**File:** `src/views/visualization/metricsView.ts`
**Math primitives:** `src/core/math.ts`

All metrics update every 500 ms using the current rolling buffer.

---

| Metric | Unit | Label | Formula (source code) | Normal range | Warning → Alert |
|---|---|---|---|---|---|
| **Dominant Frequency** | Hz | Frequency | FFT peak bin in 4–12 Hz window (`calculateDominantFrequency`) | 4–6 Hz | outside 4–6 → outside 3–8 |
| **RMS Amplitude** | RU | RMS | Windowed RMS over last 20 samples (`calculateWindowedRMS`) | 0–30 RU | — → > 100 |
| **Signal Power** | RU² | Power | `rms²` (mean square) | –20 to 10 | outside → outside –40 to 30 |
| **Regularity** | % | Regularity | `max(0, 100 − (noise/rms) × 100)` | 60–100% | < 60% → < 0% |
| **UPDRS Estimate** | /4 | UPDRS | `freq 4–6 Hz → 2`, `freq > 6 Hz → 3`, else `1` | 0–1 | — → > 4 |
| **SNR** | dB | SNR | `20 × log10(rms / noise)`, capped at 60 dB | 15–40 dB | < 15 → < –10 |
| **Peak-to-Peak** | RU | Pk–Pk | `peak × 2` where peak = max(abs(samples)) | 0–60 RU | — → > 120 |
| **Bandwidth** | Hz | Bandwidth | `max(0.2, noise × 2)` | 0–2 Hz | — → > 6 |
| **Stability** | % | Stability | Same as Regularity: `max(0, 100 − (noise/rms) × 100)` | 70–100% | < 70% → < 0% |
| **Harmonic Ratio** | % | Harmonic | `dominantFreq × 2` (first harmonic frequency) | 0–60% | — → > 150 |

### Key intermediate values

```
summary = calculateSummary(buffer)
  .avg   = mean of all samples
  .rms   = sqrt(mean(x²))
  .peak  = max(abs(x))
  .noise = max(0, rms - abs(avg))   ← proxy for non-stationarity / noise floor

dominantFreq = calculateDominantFrequency(buffer, sampleRate)
  → 256-sample Hann-windowed DFT, peak magnitude bin in 4–12 Hz
  → returns 0 if buffer has < 256 samples
```

### To recalibrate thresholds

All colour-coded indicator thresholds (green / amber / red) are set in `updateClinicalMetricsUI()`:

```ts
// src/views/visualization/metricsView.ts  — updateClinicalMetricsUI()
this.updateIndicator(this.elements.freqIndicator,        m.frequency,  4,  6,   3,   8);
//                                                                      ^normalMin ^normalMax ^alertMin ^alertMax
this.updateIndicator(this.elements.rmsIndicator,         m.rms,        0, 30,   0, 100);
this.updateIndicator(this.elements.powerIndicator,       m.power,    -20, 10, -40,  30);
this.updateIndicator(this.elements.regularityIndicator,  m.regularity, 60,100,   0, 100);
this.updateIndicator(this.elements.updrsIndicator,       m.updrs,      0,  1,   0,   4);
this.updateIndicator(this.elements.snrIndicator,         m.snr,       15, 40, -10,  40);
this.updateIndicator(this.elements.peakToPeakIndicator,  m.peakToPeak, 0, 60,   0, 120);
this.updateIndicator(this.elements.bandwidthIndicator,   m.bandwidth,  0,  2,   0,   6);
this.updateIndicator(this.elements.stabilityIndicator,   m.stability, 70,100,   0, 100);
this.updateIndicator(this.elements.harmonicIndicator,    m.harmonic,   0, 60,   0, 150);
```

Replace the four numeric arguments per line to match your clinical reference ranges once real hardware
data is available.

### Units note — "RU" (Raw Units)

The dashboard does not enforce physical units on the incoming signal. RMS, Power, and Peak-to-Peak are
expressed in whatever units the firmware emits (g, mg, m/s², ADC counts, etc.). Once the firmware is
finalised, update the unit labels in `index.html` to match (search for `RU`).

---

## Integration Checklist

- [ ] Set correct BLE UUIDs in `bleConfig.ts`
- [ ] Set `namePrefix` to your device name (optional but recommended)
- [ ] Confirm baud rate in `serialService.ts` matches firmware UART config
- [ ] Confirm CSV column order matches the expected `t, ax, ay, az, gx, gy, gz` layout (or edit the destructuring)
- [ ] Decide on BLE telemetry format (JSON vs binary) and implement on firmware side
- [ ] Implement ping/pong echo on the telemetry characteristic for latency testing (optional)
- [ ] Adjust `freq`/`amp`/`noise` clamp ranges in `paramsViewModel.ts` to match hardware limits
- [ ] Update slider `min`/`max` in `index.html` to match the new ranges
