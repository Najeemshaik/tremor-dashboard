import type { ParamsState } from "../../state/types.js";

export class MockTelemetryService {
  private t = 0;

  reset() {
    this.t = 0;
  }

  nextSample({ delta, params }: { delta: number; params: ParamsState }) {
    this.t += delta;
    const freq = params.freq;
    const amp = params.enabled ? params.amp : 0;
    const noise = params.noise;
    const signal = amp * Math.sin(2 * Math.PI * freq * this.t);
    const noiseVal = (Math.random() * 2 - 1) * noise * 0.35;
    return {
      t: this.t,
      sample: signal + noiseVal
    };
  }
}
