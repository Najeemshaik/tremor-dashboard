import type { ParamsState, ImuSample } from "../../state/types.js";

/**
 * AR(6) autoregressive tremor model.
 *
 * Generates a stochastic signal with a dominant frequency matching `params.freq`
 * using a 6th-order autoregressive process — consistent with the embedded firmware
 * model described in the Capstone design report (Becker et al. ARMA >= 6).
 *
 * Three independent AR(6) processes run for ax, ay, az.
 * Gyro channels (gx, gy, gz) are the finite difference of the accel channels
 * scaled to approximate angular rate, matching the hardware CSV output format.
 */
export class MockTelemetryService {
  private t = 0;
  private readonly ORDER = 6;

  private histAx: number[] = new Array(6).fill(0);
  private histAy: number[] = new Array(6).fill(0);
  private histAz: number[] = new Array(6).fill(0);

  private prevAx = 0;
  private prevAy = 0;
  private prevAz = 0;

  reset() {
    this.t = 0;
    this.histAx = new Array(this.ORDER).fill(0);
    this.histAy = new Array(this.ORDER).fill(0);
    this.histAz = new Array(this.ORDER).fill(0);
    this.prevAx = 0;
    this.prevAy = 0;
    this.prevAz = 0;
  }

  nextSample({ delta, params }: { delta: number; params: ParamsState }): { t: number; sample: number; imu: ImuSample } {
    this.t += delta;
    const freq = params.freq;
    const amp = params.enabled ? params.amp / 100 : 0;
    const noiseLevel = params.noise / 100;

    const coeffs = this.buildCoeffs(freq, delta);

    const ax = this.stepAR(this.histAx, coeffs, amp, noiseLevel);
    const ay = this.stepAR(this.histAy, coeffs, amp * 1.2, noiseLevel);
    const az = this.stepAR(this.histAz, coeffs, amp * 0.6, noiseLevel);

    const dtSafe = delta > 0 ? delta : 1 / 40;
    const gx = ((ax - this.prevAx) / dtSafe) * 8;
    const gy = ((ay - this.prevAy) / dtSafe) * 8;
    const gz = ((az - this.prevAz) / dtSafe) * 8;

    this.prevAx = ax;
    this.prevAy = ay;
    this.prevAz = az;

    const imu: ImuSample = { t: this.t, ax, ay, az, gx, gy, gz };
    return { t: this.t, sample: ay, imu };
  }

  /**
   * Build AR(6) coefficients from three conjugate pole pairs placed at
   * freq, ~2*freq, ~3*freq with damping r=0.92, giving realistic spectral spread.
   */
  private buildCoeffs(freq: number, delta: number): number[] {
    const fs = delta > 0 ? 1 / delta : 40;
    const r = 0.92;
    const freqs = [freq, freq * 1.9, freq * 3.1];
    let poly = [1.0];
    for (const f of freqs) {
      const omega = (2 * Math.PI * Math.min(f, fs * 0.45)) / fs;
      const a1 = -2 * r * Math.cos(omega);
      const a2 = r * r;
      poly = this.polyConvolve(poly, [1, a1, a2]);
    }
    return poly.slice(1).map((c) => -c);
  }

  private polyConvolve(a: number[], b: number[]): number[] {
    const out = new Array(a.length + b.length - 1).fill(0) as number[];
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        out[i + j] += a[i] * b[j];
      }
    }
    return out;
  }

  private stepAR(hist: number[], coeffs: number[], amp: number, noiseLevel: number): number {
    const noise = (Math.random() * 2 - 1) * noiseLevel * amp * 0.4;
    let val = noise;
    for (let i = 0; i < coeffs.length; i++) {
      val += coeffs[i] * (hist[i] ?? 0);
    }
    val = Math.tanh(val / (amp * 2 + 0.001)) * (amp * 2);
    hist.unshift(val);
    hist.length = coeffs.length;
    return val;
  }
}
