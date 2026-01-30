export type Profile = {
  id: string;
  name: string;
  updated: string;
  freq: number;
  amp: number;
  noise: number;
};

export type SequenceStep = {
  duration: number;
  freq: number;
  amp: number;
  noise: number;
};

export type Sequence = {
  id: string;
  name: string;
  steps: SequenceStep[];
};

export type SessionSummary = {
  avg: number;
  rms: number;
  peak: number;
  noise: number;
};

export type Session = {
  id: string;
  name: string;
  start: string;
  durationSec: number;
  sampleCount: number;
  samples: number[];
  summary: SessionSummary;
};

export type ConnectionState = {
  mode: "mock" | "bluetooth" | "cable";
  status: "disconnected" | "connecting" | "connected";
  latency: number | null;
  per: number | null;
  device: unknown;
  server: unknown;
  controlChar: unknown;
  telemetryChar: unknown;
  lastPingAt: number | null;
  lastPingSeq: number;
  perStats: {
    lastSeq: number | null;
    received: number;
    dropped: number;
  };
  latencyTest: {
    active: boolean;
    samples: number[];
    pendingSeq: number | null;
  };
};

export type ParamsState = {
  freq: number;
  amp: number;
  noise: number;
  enabled: boolean;
};

export type VisualizationState = {
  buffer: number[];
  t: number;
  freeze: boolean;
  lastSample: number;
  mouseX: number | null;
  mouseY: number | null;
  keyboardIndex: number | null;
  usingKeyboard: boolean;
  sampleRate: number;
  freezeSpectrum: boolean;
  gain: number;
  autoScale: boolean;
  windowSeconds: number;
  snapshot: number[] | null;
};

export type PlaybackState = {
  intervalId: number | null;
  seqId: string | null;
  stepIndex: number;
  elapsed: number;
  playing: boolean;
};

export type ClinicalMetrics = {
  frequency: number;
  rms: number;
  power: number;
  regularity: number;
  updrs: number;
  snr: number;
  peakToPeak: number;
  bandwidth: number;
  stability: number;
  harmonic: number;
};

export type AppState = {
  connection: ConnectionState;
  params: ParamsState;
  lastSent: ParamsState;
  lastSentAt: string | null;
  profiles: Profile[];
  sequences: Sequence[];
  sessions: Session[];
  sequenceSync: Record<string, { syncedAt: string } | undefined>;
  selectedSequenceId: string | null;
  logging: boolean;
  activeSession: (Session & { startTime: number }) | null;
  visualization: VisualizationState;
  playback: PlaybackState;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  contrast: "normal" | "high";
  metricHistory: {
    dominantFreq: number[];
  };
  clinicalMetrics: ClinicalMetrics;
};
