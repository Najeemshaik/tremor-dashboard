export function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function generateSamples(freq: number, amp: number, noise: number, count: number) {
  const samples: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const signal = amp * Math.sin(2 * Math.PI * freq * t);
    const noiseVal = (Math.random() * 2 - 1) * noise * 0.4;
    samples.push(signal + noiseVal);
  }
  return samples;
}

export function calculateSummary(samples?: number[]) {
  if (!samples || samples.length === 0) {
    return { rms: 0, peak: 0, avg: 0, noise: 0 };
  }
  let sum = 0;
  let sumSq = 0;
  let peak = 0;
  samples.forEach((value) => {
    sum += value;
    sumSq += value * value;
    peak = Math.max(peak, Math.abs(value));
  });
  const avg = sum / samples.length;
  const rms = Math.sqrt(sumSq / samples.length);
  const noise = Math.max(0, rms - Math.abs(avg));
  return { avg, rms, peak, noise };
}

export function calculateWindowedRMS(samples: number[] | undefined, windowSize: number) {
  if (!samples || samples.length === 0) return 0;
  const start = Math.max(0, samples.length - windowSize);
  let sumSq = 0;
  let count = 0;
  for (let i = start; i < samples.length; i += 1) {
    const v = samples[i];
    sumSq += v * v;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.sqrt(sumSq / count);
}

export function calculateSpectrum(samples: number[] | undefined, sampleRate: number) {
  const N = 256;
  if (!samples || samples.length < N) {
    return [] as { freq: number; mag: number }[];
  }
  const start = samples.length - N;
  const windowed = new Array(N);
  for (let i = 0; i < N; i += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = samples[start + i] * w;
  }

  const spectrum: { freq: number; mag: number }[] = [];
  for (let k = 1; k < N / 2; k += 1) {
    const freq = (k * sampleRate) / N;
    let re = 0;
    let im = 0;
    const angleStep = (2 * Math.PI * k) / N;
    for (let n = 0; n < N; n += 1) {
      const angle = angleStep * n;
      re += windowed[n] * Math.cos(angle);
      im -= windowed[n] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im);
    spectrum.push({ freq, mag });
  }
  return spectrum;
}

export function calculateDominantFrequency(samples: number[] | undefined, sampleRate: number) {
  const N = 256;
  if (!samples || samples.length < N) {
    return 0;
  }
  const start = samples.length - N;
  const windowed = new Array(N);
  for (let i = 0; i < N; i += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = samples[start + i] * w;
  }

  let maxMag = 0;
  let maxBin = 0;
  for (let k = 1; k < N / 2; k += 1) {
    const freq = (k * sampleRate) / N;
    if (freq < 4 || freq > 12) continue;
    let re = 0;
    let im = 0;
    const angleStep = (2 * Math.PI * k) / N;
    for (let n = 0; n < N; n += 1) {
      const angle = angleStep * n;
      re += windowed[n] * Math.cos(angle);
      im -= windowed[n] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im);
    if (mag > maxMag) {
      maxMag = mag;
      maxBin = k;
    }
  }

  return (maxBin * sampleRate) / N;
}
