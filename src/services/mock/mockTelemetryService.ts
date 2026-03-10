import type { ParamsState, ImuSample } from "../../state/types.js";

/**
 * Tremor signal synthesiser.
 *
 * Produces a band-limited oscillation at `params.freq` Hz with amplitude
 * proportional to `params.amp` and stochastic variation proportional to
 * `params.noise`.  Each axis uses an independent phase offset so they
 * differ realistically.
 *
 * Implementation: sinusoidal carrier + band-limited noise shaped by a
 * one-pole low-pass filter, avoiding the frame-rate-dependent instability
 * of a recalculated AR filter.
 */
export class MockTelemetryService {
  private t = 0;

  // Low-pass filtered noise state per axis
  private nAx = 0;
  private nAy = 0;
  private nAz = 0;

  // Phase offsets give each axis a distinct-looking signal
  private readonly phaseAx = 0;
  private readonly phaseAy = Math.PI / 3;
  private readonly phaseAz = (2 * Math.PI) / 3;

  reset() {
    this.t = 0;
    this.nAx = 0;
    this.nAy = 0;
    this.nAz = 0;
  }

  nextSample({ delta, params }: { delta: number; params: ParamsState }): { t: number; sample: number; imu: ImuSample } {
    const dt = delta > 0 ? delta : 1 / 60;
    this.t += dt;

    const freq = params.freq;
    const amp = params.enabled ? params.amp / 100 : 0;
    const noiseLevel = params.noise / 100;

    // Low-pass filter cutoff ~2× freq keeps noise in the tremor band
    const alpha = Math.min(1, dt * freq * 2 * Math.PI * 0.5);

    this.nAx += alpha * ((Math.random() * 2 - 1) - this.nAx);
    this.nAy += alpha * ((Math.random() * 2 - 1) - this.nAy);
    this.nAz += alpha * ((Math.random() * 2 - 1) - this.nAz);

    const omega = 2 * Math.PI * freq * this.t;
    const ax = amp * (Math.sin(omega + this.phaseAx) + noiseLevel * this.nAx);
    const ay = amp * (Math.sin(omega + this.phaseAy) + noiseLevel * this.nAy);
    const az = amp * (Math.sin(omega + this.phaseAz) + noiseLevel * this.nAz) * 0.6;

    const gx = ax * freq * 8;
    const gy = ay * freq * 8;
    const gz = az * freq * 8;

    const imu: ImuSample = { t: this.t, ax, ay, az, gx, gy, gz };
    return { t: this.t, sample: ay, imu };
  }
}
