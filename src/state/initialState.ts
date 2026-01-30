import { SIM_SAMPLE_RATE } from "../core/constants.js";
import type { AppState } from "./types.js";

export function createInitialState(): AppState {
  return {
    connection: {
      mode: "mock",
      status: "disconnected",
      latency: null,
      per: null,
      device: null,
      server: null,
      controlChar: null,
      telemetryChar: null,
      lastPingAt: null,
      lastPingSeq: 0,
      perStats: {
        lastSeq: null,
        received: 0,
        dropped: 0
      },
      latencyTest: {
        active: false,
        samples: [],
        pendingSeq: null
      }
    },
    params: {
      freq: 5,
      amp: 40,
      noise: 12,
      enabled: true
    },
    lastSent: {
      freq: 5,
      amp: 40,
      noise: 12,
      enabled: true
    },
    lastSentAt: null,
    profiles: [],
    sequences: [],
    sessions: [],
    sequenceSync: {},
    selectedSequenceId: null,
    logging: false,
    activeSession: null,
    visualization: {
      buffer: new Array(300).fill(0),
      t: 0,
      freeze: false,
      lastSample: 0,
      mouseX: null,
      mouseY: null,
      keyboardIndex: null,
      usingKeyboard: false,
      sampleRate: SIM_SAMPLE_RATE,
      freezeSpectrum: false,
      gain: 1,
      autoScale: true,
      windowSeconds: 5,
      snapshot: null
    },
    playback: {
      intervalId: null,
      seqId: null,
      stepIndex: 0,
      elapsed: 0,
      playing: false
    },
    theme: "light",
    sidebarCollapsed: false,
    contrast: "normal",
    metricHistory: {
      dominantFreq: []
    },
    clinicalMetrics: {
      frequency: 0,
      rms: 0,
      power: 0,
      regularity: 0,
      updrs: 0,
      snr: 0,
      peakToPeak: 0,
      bandwidth: 0,
      stability: 0,
      harmonic: 0
    }
  };
}
