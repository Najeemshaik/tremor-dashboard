/* global window, document */

/**
 * Tremor Monitor Pro - Clinical Dashboard
 * Professional Parkinson's Disease Tremor Analysis Software
 */

const STORAGE_KEY = "tremor-sim-platform";
const THEME_KEY = "tremor-theme";
const SIDEBAR_COLLAPSED_KEY = "tremor-sidebar-collapsed";
const CONTRAST_KEY = "tremor-contrast";
const SIM_SAMPLE_RATE = 60;

// Update these UUIDs to match your device's BLE service/characteristics.
const BLE_CONFIG = {
  deviceNamePrefix: "Tremor",
  serviceUUID: "0000fff0-0000-1000-8000-00805f9b34fb",
  controlCharUUID: "0000fff1-0000-1000-8000-00805f9b34fb",
  telemetryCharUUID: "0000fff2-0000-1000-8000-00805f9b34fb"
};

const LATENCY_WARNING_MS = 100;
const LATENCY_ALERT_MS = 300;
const LATENCY_TEST_INTERVAL_MS = 1000;
const LATENCY_TEST_SAMPLE_WINDOW = 5;

// Seed data for initial profiles
const seedProfiles = [
  { id: "p1", name: "PD Rest Tremor", updated: "2024-03-14 09:12", freq: 5, amp: 45, noise: 8 },
  { id: "p2", name: "Essential Tremor", updated: "2024-03-18 15:44", freq: 7, amp: 35, noise: 15 },
  { id: "p3", name: "Postural Tremor", updated: "2024-03-21 11:05", freq: 5, amp: 25, noise: 12 }
];

const seedSequences = [
  {
    id: "s1",
    name: "Medication Response",
    steps: [
      { duration: 10, freq: 5, amp: 50, noise: 10 },
      { duration: 15, freq: 5, amp: 35, noise: 8 },
      { duration: 10, freq: 4, amp: 20, noise: 6 }
    ]
  }
];

const seedSessions = [
  createSessionSeed("Morning Assessment", "2024-03-20 08:02", 420, 2100, 5, 42),
  createSessionSeed("Post-Medication", "2024-03-21 16:28", 300, 1800, 4, 28)
];

const state = {
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

const elements = {};
let activeModal = null;
let lastFocusedElement = null;

// Helper functions
function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return Number(value).toFixed(decimals);
}

function formatDate(value) {
  if (!value) return "--";
  return value;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

function createSessionSeed(name, start, durationSec, sampleCount, freq, amp) {
  const samples = generateSamples(freq, amp, 10, 200);
  const summary = calculateSummary(samples);
  return {
    id: createId("session"),
    name,
    start,
    durationSec,
    sampleCount,
    samples,
    summary
  };
}

function generateSamples(freq, amp, noise, count) {
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const signal = amp * Math.sin(2 * Math.PI * freq * t);
    const noiseVal = (Math.random() * 2 - 1) * noise * 0.4;
    samples.push(signal + noiseVal);
  }
  return samples;
}

function calculateSummary(samples) {
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

function calculateWindowedRMS(samples, windowSize) {
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

function calculateSpectrum(samples, sampleRate) {
  const N = 256;
  if (!samples || samples.length < N) {
    return [];
  }
  const start = samples.length - N;
  const windowed = new Array(N);
  for (let i = 0; i < N; i += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = samples[start + i] * w;
  }

  const spectrum = [];
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

function calculateDominantFrequency(samples, sampleRate) {
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

// Theme management
function initTheme() {
  const savedTheme = window.localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme) {
    state.theme = savedTheme;
  } else if (prefersDark) {
    state.theme = "dark";
  }

  applyTheme();
}

function initContrast() {
  const savedContrast = window.localStorage.getItem(CONTRAST_KEY);
  if (savedContrast === "high") {
    state.contrast = "high";
  }
  applyContrast();
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);

  const lightIcon = $("#themeIconLight");
  const darkIcon = $("#themeIconDark");
  const darkModeToggle = $("#settingDarkMode");

  if (lightIcon && darkIcon) {
    if (state.theme === "dark") {
      lightIcon.style.display = "none";
      darkIcon.style.display = "block";
    } else {
      lightIcon.style.display = "block";
      darkIcon.style.display = "none";
    }
  }

  if (darkModeToggle) {
    darkModeToggle.checked = state.theme === "dark";
  }

  window.localStorage.setItem(THEME_KEY, state.theme);
}

function applyContrast() {
  if (state.contrast === "high") {
    document.documentElement.setAttribute("data-contrast", "high");
  } else {
    document.documentElement.removeAttribute("data-contrast");
  }

  if (elements.settingHighContrast) {
    elements.settingHighContrast.checked = state.contrast === "high";
  }

  window.localStorage.setItem(CONTRAST_KEY, state.contrast);
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme();
}

// Sidebar collapse management
function initSidebarCollapse() {
  const savedState = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  if (savedState === "true") {
    state.sidebarCollapsed = true;
  }
  applySidebarCollapse();
}

function applySidebarCollapse() {
  const main = $(".main");
  const isMobile = window.innerWidth <= 900;

  if (isMobile) {
    elements.sidebar.classList.remove("collapsed");
    if (main) {
      main.style.marginLeft = "0";
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, state.sidebarCollapsed);
    return;
  }

  if (state.sidebarCollapsed) {
    elements.sidebar.classList.add("collapsed");
    if (main && window.innerWidth > 900) {
      main.style.marginLeft = "var(--sidebar-collapsed)";
    }
  } else {
    elements.sidebar.classList.remove("collapsed");
    if (main && window.innerWidth > 900) {
      main.style.marginLeft = "var(--sidebar-width)";
    }
  }
  if (elements.sidebarToggle) {
    elements.sidebarToggle.setAttribute("aria-pressed", state.sidebarCollapsed ? "true" : "false");
  }
  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, state.sidebarCollapsed);
}

function toggleSidebarCollapse() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  applySidebarCollapse();
}

// Data persistence
function loadData() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.profiles = parsed.profiles || seedProfiles;
      state.sequences = parsed.sequences || seedSequences;
      state.sessions = parsed.sessions || seedSessions;
      return;
    } catch (error) {
      // Fallback to seeds
    }
  }
  state.profiles = seedProfiles;
  state.sequences = seedSequences;
  state.sessions = seedSessions;
}

function persist() {
  const payload = {
    profiles: state.profiles,
    sequences: state.sequences,
    sessions: state.sessions
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// DOM element binding
function bindElements() {
  elements.app = $(".app");
  elements.tabs = $$(".nav-item");
  elements.panels = $$(".tab-panel");
  elements.pageTitle = $("#pageTitle");
  elements.sidebar = $("#sidebar");
  elements.sidebarToggle = $("#sidebarToggle");
  elements.mobileNavToggle = $("#mobileNavToggle");
  elements.sidebarOverlay = $("#sidebarOverlay");
  elements.sidebarStatusText = $("#sidebarStatusText");
  elements.sidebarStatusDot = $("#sidebarStatusDot");
  elements.topStatusPill = $("#topStatusPill");
  elements.topLatency = $("#topLatency");
  elements.topPer = $("#topPer");
  elements.themeToggle = $("#themeToggle");

  elements.connectionMode = $("#connectionMode");
  elements.connectBtn = $("#connectBtn");
  elements.pingBtn = $("#pingBtn");
  elements.latencyTestBtn = $("#latencyTestBtn");
  elements.latencyWarning = $("#latencyWarning");
  elements.connectionStatusPill = $("#connectionStatusPill");
  elements.latencyValue = $("#latencyValue");
  elements.perValue = $("#perValue");

  elements.logToggleBtn = $("#logToggleBtn");
  elements.sidebarLogBtn = $("#sidebarLogBtn");
  elements.sessionsLogBtn = $("#sessionsLogBtn");
  elements.loggingStatus = $("#loggingStatus");

  elements.freqRange = $("#freqRange");
  elements.freqNumber = $("#freqNumber");
  elements.ampRange = $("#ampRange");
  elements.ampNumber = $("#ampNumber");
  elements.noiseRange = $("#noiseRange");
  elements.noiseNumber = $("#noiseNumber");
  elements.enableTremor = $("#enableTremor");
  elements.sendBtn = $("#sendBtn");
  elements.stopBtn = $("#stopBtn");
  elements.lastSent = $("#lastSent");
  elements.unsavedIndicator = $("#unsavedIndicator");

  elements.freezeBtn = $("#freezeBtn");
  elements.clearBtn = $("#clearBtn");
  elements.tremorCanvas = $("#tremorCanvas");
  elements.chartContainer = $("#chartContainer");
  elements.chartTooltip = $("#chartTooltip");
  elements.chartLive = $("#chartLive");
  elements.spectrumCanvas = $("#spectrumCanvas");
  elements.sampleRateValue = $("#sampleRateValue");
  elements.spectrumFreezeBtn = $("#spectrumFreezeBtn");
  elements.windowRange = $("#windowRange");
  elements.windowValue = $("#windowValue");
  elements.gainRange = $("#gainRange");
  elements.gainValue = $("#gainValue");
  elements.snapshotBtn = $("#snapshotBtn");

  // Clinical metrics
  elements.metricFrequency = $("#metricFrequency");
  elements.metricRMS = $("#metricRMS");
  elements.metricPower = $("#metricPower");
  elements.metricRegularity = $("#metricRegularity");
  elements.metricUPDRS = $("#metricUPDRS");
  elements.metricSNR = $("#metricSNR");
  elements.metricPeakToPeak = $("#metricPeakToPeak");
  elements.metricBandwidth = $("#metricBandwidth");
  elements.metricStability = $("#metricStability");
  elements.metricHarmonic = $("#metricHarmonic");

  // Metric indicators
  elements.freqIndicator = $("#freqIndicator");
  elements.rmsIndicator = $("#rmsIndicator");
  elements.powerIndicator = $("#powerIndicator");
  elements.regularityIndicator = $("#regularityIndicator");
  elements.updrsIndicator = $("#updrsIndicator");
  elements.snrIndicator = $("#snrIndicator");
  elements.peakToPeakIndicator = $("#peakToPeakIndicator");
  elements.bandwidthIndicator = $("#bandwidthIndicator");
  elements.stabilityIndicator = $("#stabilityIndicator");
  elements.harmonicIndicator = $("#harmonicIndicator");

  elements.profileSelect = $("#profileSelect");
  elements.loadProfileBtn = $("#loadProfileBtn");
  elements.saveProfileBtn = $("#saveProfileBtn");

  elements.healthMode = $("#healthMode");

  elements.profilesTable = $("#profilesTable tbody");
  elements.profilesEmpty = $("#profilesEmpty");

  elements.sequenceList = $("#sequenceList");
  elements.sequenceEditor = $("#sequenceEditor");
  elements.sequencesEmpty = $("#sequencesEmpty");
  elements.newSequenceBtn = $("#newSequenceBtn");

  elements.sessionsTable = $("#sessionsTable tbody");
  elements.sessionsEmpty = $("#sessionsEmpty");

  elements.profileModal = $("#profileModal");
  elements.profileForm = $("#profileForm");
  elements.profileName = $("#profileName");

  elements.sessionModal = $("#sessionModal");
  elements.sessionSummary = $("#sessionSummary");
  elements.sessionCanvas = $("#sessionCanvas");
  elements.deleteSessionBtn = $("#deleteSessionBtn");
  elements.exportCsvBtn = $("#exportCsvBtn");
  elements.exportJsonBtn = $("#exportJsonBtn");

  elements.settingDarkMode = $("#settingDarkMode");
  elements.settingHighContrast = $("#settingHighContrast");
}

// Tab navigation
function initTabs() {
  elements.tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab, { focus: false });
      setSidebarOpen(false);
    });

    tab.addEventListener("keydown", (event) => {
      const key = event.key;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
      event.preventDefault();
      const lastIndex = elements.tabs.length - 1;
      let nextIndex = index;
      if (key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
      if (key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
      if (key === "Home") nextIndex = 0;
      if (key === "End") nextIndex = lastIndex;
      const nextTab = elements.tabs[nextIndex];
      if (nextTab) {
        setActiveTab(nextTab.dataset.tab, { focus: true });
      }
    });
  });

  const initialTab = elements.tabs.find((tab) => tab.classList.contains("active"));
  if (initialTab) {
    setActiveTab(initialTab.dataset.tab, { focus: false });
  }
}

function setActiveTab(tabId, { focus = false } = {}) {
  elements.tabs.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.tabIndex = isActive ? 0 : -1;
    if (isActive && focus) {
      btn.focus();
    }
  });

  elements.panels.forEach((panel) => {
    if (panel.id === `tab-${tabId}`) {
      panel.classList.remove("hidden");
      panel.classList.add("active");
    } else {
      panel.classList.add("hidden");
      panel.classList.remove("active");
    }
  });

  const activeTab = elements.tabs.find((btn) => btn.dataset.tab === tabId);
  if (activeTab) {
    elements.pageTitle.textContent = activeTab.textContent.trim();
  }
}

function setSidebarOpen(open) {
  if (open) {
    elements.sidebar.classList.add("open");
    elements.sidebarOverlay.classList.add("visible");
    elements.sidebarOverlay.setAttribute("aria-hidden", "false");
  } else {
    elements.sidebar.classList.remove("open");
    elements.sidebarOverlay.classList.remove("visible");
    elements.sidebarOverlay.setAttribute("aria-hidden", "true");
  }
  if (elements.mobileNavToggle) {
    elements.mobileNavToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
}

function initSidebarToggle() {
  const toggle = () => {
    const isOpen = elements.sidebar.classList.contains("open");
    setSidebarOpen(!isOpen);
  };
  elements.mobileNavToggle.addEventListener("click", toggle);
  elements.sidebarOverlay.addEventListener("click", () => setSidebarOpen(false));
}

// Connection UI
function updateConnectionUI() {
  const status = state.connection.status;
  elements.connectionStatusPill.textContent = capitalize(status);
  elements.connectionStatusPill.dataset.status = status;
  elements.topStatusPill.textContent = capitalize(status);
  elements.topStatusPill.dataset.status = status;

  elements.sidebarStatusText.textContent = capitalize(status);
  elements.sidebarStatusDot.className = `status-dot ${status}`;

  const buttonText = status === "connected" ? "Disconnect" : "Connect";
  elements.connectBtn.innerHTML = `
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${status === "connected"
        ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
        : '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>'
      }
    </svg>
    ${buttonText}
  `;
  elements.connectBtn.disabled = status === "connecting";

  const latency = state.connection.latency;
  const per = state.connection.per;
  elements.latencyValue.textContent = formatNumber(latency, 0);
  elements.perValue.textContent = formatNumber(per, 2);
  elements.topLatency.textContent = formatNumber(latency, 0);
  elements.topPer.textContent = formatNumber(per, 2);

  if (elements.healthMode) {
    if (state.connection.mode === "mock") {
      elements.healthMode.textContent = "Simulation";
    } else if (state.connection.mode === "cable") {
      elements.healthMode.textContent = "USB Cable (Stub)";
    } else {
      elements.healthMode.textContent = capitalize(state.connection.mode);
    }
  }

  updateLatencyTestUI();
  updateLatencyWarning();
  updateDeviceSyncUI();
}

function updateBluetoothOptionState() {
  const option = elements.connectionMode?.querySelector('option[value="bluetooth"]');
  if (!option) return;
  if (!isBluetoothAvailable()) {
    option.disabled = true;
    option.textContent = "Bluetooth (Unavailable)";
    if (elements.connectionMode.value === "bluetooth") {
      elements.connectionMode.value = "mock";
      state.connection.mode = "mock";
    }
  } else {
    option.disabled = false;
    option.textContent = "Bluetooth";
  }
}

function updateLatencyWarning() {
  if (!elements.latencyWarning) return;
  const latency = state.connection.latency;
  const isConnected = state.connection.status === "connected";
  if (!isConnected || latency === null || latency === undefined) {
    elements.latencyWarning.classList.add("hidden");
    elements.latencyWarning.classList.remove("warning-text", "alert-text");
    elements.latencyWarning.classList.add("warning-text");
    return;
  }

  if (latency >= LATENCY_ALERT_MS) {
    elements.latencyWarning.textContent = `High latency detected (${Math.round(latency)} ms).`;
    elements.latencyWarning.classList.remove("hidden", "warning-text");
    elements.latencyWarning.classList.add("alert-text");
    return;
  }

  if (latency >= LATENCY_WARNING_MS) {
    elements.latencyWarning.textContent = `Latency above target (${Math.round(latency)} ms).`;
    elements.latencyWarning.classList.remove("hidden", "alert-text");
    elements.latencyWarning.classList.add("warning-text");
    return;
  }

  elements.latencyWarning.classList.add("hidden");
  elements.latencyWarning.classList.remove("alert-text");
  elements.latencyWarning.classList.add("warning-text");
}

function updateLatencyTestUI() {
  if (!elements.latencyTestBtn) return;
  const canTest =
    state.connection.mode === "bluetooth" &&
    state.connection.status === "connected" &&
    isBluetoothAvailable();
  elements.latencyTestBtn.disabled = !canTest;
  elements.latencyTestBtn.textContent = state.connection.latencyTest.active
    ? "Stop Latency Test"
    : "Start Latency Test";
}

function updateDeviceSyncUI() {
  if (!elements.sequenceEditor) return;
  const disabled =
    state.connection.mode !== "bluetooth" || state.connection.status !== "connected";
  elements.sequenceEditor
    .querySelectorAll('[data-action="device-sync"], [data-action="device-play"], [data-action="device-stop"]')
    .forEach((button) => {
      button.disabled = disabled;
    });
}

function statusColor(status) {
  if (status === "connected") return "#22c55e";
  if (status === "connecting") return "#f59e0b";
  return "#f87171";
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Bluetooth helpers
const bleTextEncoder = new TextEncoder();
const bleTextDecoder = new TextDecoder("utf-8");

function isBluetoothAvailable() {
  return Boolean(window.isSecureContext && navigator.bluetooth);
}

function buildBluetoothRequestOptions() {
  const options = { optionalServices: [BLE_CONFIG.serviceUUID] };
  if (BLE_CONFIG.deviceNamePrefix) {
    options.filters = [{ namePrefix: BLE_CONFIG.deviceNamePrefix }];
  } else {
    options.acceptAllDevices = true;
  }
  return options;
}

function resetConnectionMetrics() {
  state.connection.latency = null;
  state.connection.per = null;
  resetPerStats();
  resetLatencyTestState();
}

function resetPerStats() {
  state.connection.perStats = {
    lastSeq: null,
    received: 0,
    dropped: 0
  };
}

function resetLatencyTestState() {
  state.connection.lastPingAt = null;
  state.connection.lastPingSeq = 0;
  state.connection.latencyTest.active = false;
  state.connection.latencyTest.samples = [];
  state.connection.latencyTest.pendingSeq = null;
}

function clearBluetoothState() {
  if (state.connection.telemetryChar) {
    state.connection.telemetryChar.removeEventListener("characteristicvaluechanged", handleBluetoothTelemetry);
  }
  state.connection.device = null;
  state.connection.server = null;
  state.connection.controlChar = null;
  state.connection.telemetryChar = null;
  state.connection.lastPingAt = null;
  state.connection.lastPingSeq = 0;
  state.connection.latencyTest.pendingSeq = null;
}

function handleBluetoothDisconnect() {
  stopLatencyTest();
  clearBluetoothState();
  state.connection.status = "disconnected";
  resetConnectionMetrics();
  updateConnectionUI();
}

function isBluetoothStreaming() {
  return (
    state.connection.mode === "bluetooth" &&
    state.connection.status === "connected" &&
    state.connection.telemetryChar
  );
}

function ingestSample(sample) {
  state.visualization.lastSample = sample;
  state.visualization.buffer.push(sample);
  if (state.visualization.buffer.length > 300) {
    state.visualization.buffer.shift();
  }
}

function parseTelemetryValue(dataView) {
  if (!dataView) return {};
  const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
  const text = bleTextDecoder.decode(bytes).trim();
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return {};
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

function updatePerFromSeq(seq) {
  if (!Number.isFinite(seq)) return;
  const stats = state.connection.perStats;

  if (stats.lastSeq !== null && seq <= stats.lastSeq) {
    stats.lastSeq = seq;
    stats.received = 1;
    stats.dropped = 0;
    state.connection.per = 0;
    return;
  }

  if (stats.lastSeq !== null && seq > stats.lastSeq + 1) {
    stats.dropped += seq - stats.lastSeq - 1;
  }

  stats.received += 1;
  stats.lastSeq = seq;
  const total = stats.received + stats.dropped;
  state.connection.per = total > 0 ? Number(((stats.dropped / total) * 100).toFixed(2)) : 0;
}

function recordLatencySample(latency) {
  if (!state.connection.latencyTest.active) return;
  const samples = state.connection.latencyTest.samples;
  samples.push(latency);
  if (samples.length > LATENCY_TEST_SAMPLE_WINDOW) {
    samples.shift();
  }
}

function handleBluetoothTelemetry(event) {
  const payload = parseTelemetryValue(event.target.value);
  if (Array.isArray(payload.samples)) {
    payload.samples.forEach((sample) => {
      if (Number.isFinite(sample)) ingestSample(sample);
    });
  }
  if (Number.isFinite(payload.sample)) {
    ingestSample(payload.sample);
  }

  const seq = Number.isFinite(payload.seq)
    ? payload.seq
    : Number.isFinite(payload.sequence)
      ? payload.sequence
      : null;
  if (Number.isFinite(seq)) {
    updatePerFromSeq(seq);
  }

  const isPong = payload.type === "pong" || payload.pong === true;
  if (isPong) {
    if (Number.isFinite(payload.ts)) {
      state.connection.latency = Date.now() - payload.ts;
    } else if (
      state.connection.lastPingAt &&
      (!Number.isFinite(seq) || seq === state.connection.lastPingSeq)
    ) {
      state.connection.latency = Date.now() - state.connection.lastPingAt;
    }
    state.connection.latencyTest.pendingSeq = null;
    recordLatencySample(state.connection.latency);
  }

  if (Number.isFinite(payload.latency)) {
    state.connection.latency = payload.latency;
    recordLatencySample(payload.latency);
  }
  if (Number.isFinite(payload.per)) {
    state.connection.per = payload.per;
  }
  if (payload.latency !== undefined || payload.per !== undefined || isPong || Number.isFinite(seq)) {
    updateConnectionUI();
  }
}

async function writeCharacteristic(characteristic, data) {
  if (characteristic.writeValueWithResponse) {
    await characteristic.writeValueWithResponse(data);
  } else {
    await characteristic.writeValue(data);
  }
}

function encodeControlPayload(payload) {
  return bleTextEncoder.encode(JSON.stringify(payload));
}

async function sendBluetoothCommand(payload) {
  if (state.connection.mode !== "bluetooth" || state.connection.status !== "connected") return;
  if (!state.connection.controlChar) return;
  try {
    const data = encodeControlPayload(payload);
    await writeCharacteristic(state.connection.controlChar, data);
  } catch (error) {
    console.error("Bluetooth write failed", error);
    handleBluetoothDisconnect();
  }
}

function canRunLatencyTest() {
  return (
    state.connection.mode === "bluetooth" &&
    state.connection.status === "connected" &&
    isBluetoothAvailable()
  );
}

function scheduleLatencyTimeout(seq) {
  if (latencyTestTimeout) {
    clearTimeout(latencyTestTimeout);
  }
  latencyTestTimeout = window.setTimeout(() => {
    if (!state.connection.latencyTest.active) return;
    if (state.connection.latencyTest.pendingSeq !== seq) return;
    if (!elements.latencyWarning) return;
    elements.latencyWarning.textContent = "Latency test timed out — no response from device.";
    elements.latencyWarning.classList.remove("hidden", "warning-text");
    elements.latencyWarning.classList.add("alert-text");
  }, Math.max(LATENCY_ALERT_MS, LATENCY_TEST_INTERVAL_MS));
}

async function runLatencyTestPing() {
  if (!canRunLatencyTest() || latencyTestInFlight) return;
  latencyTestInFlight = true;
  try {
    const seq = state.connection.lastPingSeq + 1;
    state.connection.lastPingSeq = seq;
    state.connection.lastPingAt = Date.now();
    state.connection.latencyTest.pendingSeq = seq;
    await sendBluetoothCommand({ type: "ping", ts: state.connection.lastPingAt, seq });
    scheduleLatencyTimeout(seq);
  } finally {
    latencyTestInFlight = false;
  }
}

function startLatencyTest() {
  if (state.connection.latencyTest.active) return;
  if (!canRunLatencyTest()) {
    window.alert("Connect to a Bluetooth device before starting a latency test.");
    return;
  }
  state.connection.latencyTest.active = true;
  state.connection.latencyTest.samples = [];
  runLatencyTestPing();
  latencyTestTimer = window.setInterval(runLatencyTestPing, LATENCY_TEST_INTERVAL_MS);
  updateLatencyTestUI();
}

function stopLatencyTest() {
  state.connection.latencyTest.active = false;
  state.connection.latencyTest.pendingSeq = null;
  if (latencyTestTimer) {
    clearInterval(latencyTestTimer);
    latencyTestTimer = null;
  }
  if (latencyTestTimeout) {
    clearTimeout(latencyTestTimeout);
    latencyTestTimeout = null;
  }
  updateLatencyTestUI();
}

function toggleLatencyTest() {
  if (state.connection.latencyTest.active) {
    stopLatencyTest();
  } else {
    startLatencyTest();
  }
}

async function connectBluetooth() {
  if (!isBluetoothAvailable()) {
    window.alert("Bluetooth is unavailable. Use a secure context (HTTPS) and a compatible browser.");
    return;
  }

  state.connection.status = "connecting";
  updateConnectionUI();

  try {
    const device = await navigator.bluetooth.requestDevice(buildBluetoothRequestOptions());
    device.addEventListener("gattserverdisconnected", handleBluetoothDisconnect);

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_CONFIG.serviceUUID);
    const controlChar = await service.getCharacteristic(BLE_CONFIG.controlCharUUID);
    let telemetryChar = null;
    try {
      telemetryChar = await service.getCharacteristic(BLE_CONFIG.telemetryCharUUID);
    } catch (error) {
      telemetryChar = null;
    }

    if (telemetryChar && telemetryChar.properties.notify) {
      await telemetryChar.startNotifications();
      telemetryChar.addEventListener("characteristicvaluechanged", handleBluetoothTelemetry);
    }

    state.connection.device = device;
    state.connection.server = server;
    state.connection.controlChar = controlChar;
    state.connection.telemetryChar = telemetryChar;
    state.connection.status = "connected";
    resetConnectionMetrics();
    updateConnectionUI();
  } catch (error) {
    console.error("Bluetooth connection failed", error);
    handleBluetoothDisconnect();
  }
}

async function disconnectBluetooth() {
  if (state.connection.device && state.connection.device.gatt?.connected) {
    state.connection.device.gatt.disconnect();
  } else {
    handleBluetoothDisconnect();
  }
}

// Connection handling
let connectTimer = null;
let metricsTimer = null;
let latencyTestTimer = null;
let latencyTestTimeout = null;
let latencyTestInFlight = false;

function updateMetrics() {
  if (state.connection.mode !== "mock") return;
  state.connection.latency = Math.round(randomBetween(10, 80));
  state.connection.per = Number(randomBetween(0, 0.5).toFixed(2));
  updateConnectionUI();
}

function stopMockTimers() {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

function disconnectMock() {
  stopMockTimers();
  state.connection.status = "disconnected";
  resetConnectionMetrics();
  updateConnectionUI();
}

function disconnectCable() {
  state.connection.status = "disconnected";
  resetConnectionMetrics();
  updateConnectionUI();
}

function connectCable() {
  window.alert("USB Cable mode is a stub. Connect logic is not implemented yet.");
  state.connection.status = "disconnected";
  resetConnectionMetrics();
  updateConnectionUI();
}

async function handleConnectClick() {
  if (state.connection.mode === "bluetooth") {
    if (state.connection.status === "connected") {
      await disconnectBluetooth();
      return;
    }
    if (state.connection.status === "connecting") return;
    await connectBluetooth();
    return;
  }
  if (state.connection.mode === "cable") {
    connectCable();
    return;
  }

  if (state.connection.status === "connected") {
    disconnectMock();
    return;
  }
  if (state.connection.status === "connecting") {
    return;
  }
  state.connection.status = "connecting";
  updateConnectionUI();
  stopMockTimers();
  connectTimer = window.setTimeout(() => {
    state.connection.status = "connected";
    updateMetrics();
    updateConnectionUI();
    if (!metricsTimer) {
      metricsTimer = window.setInterval(() => {
        if (state.connection.status === "connected") {
          updateMetrics();
        }
      }, 2000);
    }
  }, 800);
}

async function handlePingClick() {
  if (state.connection.mode === "bluetooth") {
    if (state.connection.status !== "connected") return;
    const start = performance.now();
    const seq = state.connection.lastPingSeq + 1;
    state.connection.lastPingSeq = seq;
    state.connection.lastPingAt = Date.now();
    state.connection.latencyTest.pendingSeq = seq;
    await sendBluetoothCommand({ type: "ping", ts: state.connection.lastPingAt, seq });
    scheduleLatencyTimeout(seq);
    state.connection.latency = Math.round(performance.now() - start);
    if (state.connection.per === null) {
      state.connection.per = 0;
    }
    updateConnectionUI();
    return;
  }
  if (state.connection.mode === "cable") {
    window.alert("USB Cable mode is a stub. Ping is not available.");
    return;
  }
  updateMetrics();
}

async function handleConnectionModeChange(event) {
  const nextMode = event.target.value;
  stopLatencyTest();
  if (state.connection.mode === "bluetooth") {
    await disconnectBluetooth();
  } else if (state.connection.mode === "mock") {
    disconnectMock();
  } else if (state.connection.mode === "cable") {
    disconnectCable();
  }
  state.connection.mode = nextMode;
  state.connection.status = "disconnected";
  resetConnectionMetrics();
  updateConnectionUI();
}

// Logging/Session recording
function setLogging(enabled) {
  state.logging = enabled;
  elements.loggingStatus.textContent = enabled ? "Recording" : "Inactive";

  const label = enabled ? "Stop Recording" : "Start Recording";
  const icon = enabled
    ? '<rect x="6" y="6" width="12" height="12" rx="2"/>'
    : '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>';

  const buttonHTML = `
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </svg>
    <span class="btn-text">${label}</span>
  `;

  const sessionsButtonHTML = `
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${icon}
    </svg>
    ${label}
  `;

  elements.logToggleBtn.textContent = enabled ? "Stop" : "Start";
  elements.sidebarLogBtn.innerHTML = buttonHTML;
  elements.sidebarLogBtn.title = label;
  elements.sessionsLogBtn.innerHTML = sessionsButtonHTML;

  if (enabled) {
    const start = new Date();
    state.activeSession = {
      id: createId("session"),
      name: `Session ${start.toISOString().slice(0, 19).replace("T", " ")}`,
      start: start.toISOString().slice(0, 19).replace("T", " "),
      startTime: start.getTime(),
      durationSec: 0,
      sampleCount: 0,
      samples: [],
      summary: null
    };
    startLoggingSampler();
  } else if (state.activeSession) {
    stopLoggingSampler();
    const endTime = Date.now();
    state.activeSession.durationSec = Math.max(1, Math.round((endTime - state.activeSession.startTime) / 1000));
    state.activeSession.sampleCount = state.activeSession.samples.length;
    state.activeSession.summary = calculateSummary(state.activeSession.samples);
    state.sessions.unshift(state.activeSession);
    state.activeSession = null;
    renderSessions();
    persist();
  }
}

let loggingTimer = null;

function startLoggingSampler() {
  if (loggingTimer) return;
  loggingTimer = window.setInterval(() => {
    if (!state.activeSession) return;
    const sample = state.visualization.lastSample;
    state.activeSession.samples.push(sample);
    if (state.activeSession.samples.length > 600) {
      state.activeSession.samples.shift();
    }
  }, 200);
}

function stopLoggingSampler() {
  if (loggingTimer) {
    clearInterval(loggingTimer);
    loggingTimer = null;
  }
}

// Parameter UI
function updateParamUI() {
  elements.freqRange.value = state.params.freq;
  elements.freqNumber.value = state.params.freq.toFixed(0);
  elements.ampRange.value = state.params.amp;
  elements.ampNumber.value = state.params.amp;
  elements.noiseRange.value = state.params.noise;
  elements.noiseNumber.value = state.params.noise;
  elements.enableTremor.checked = state.params.enabled;

  const dirty = isDirty();
  elements.unsavedIndicator.style.display = dirty ? "inline-flex" : "none";
}

function updateLastSentUI() {
  if (!state.lastSentAt) {
    elements.lastSent.textContent = "--";
    return;
  }
  elements.lastSent.textContent = state.lastSentAt;
}

function isDirty() {
  return (
    state.params.freq !== state.lastSent.freq ||
    state.params.amp !== state.lastSent.amp ||
    state.params.noise !== state.lastSent.noise ||
    state.params.enabled !== state.lastSent.enabled
  );
}

function handleParamChange(key, value) {
  const clamped = clampParam(key, value);
  state.params[key] = clamped;
  updateParamUI();
}

function clampParam(key, value) {
  if (key === "freq") {
    return Math.min(12, Math.max(4, Math.round(value)));
  }
  if (key === "amp") {
    return Math.min(100, Math.max(0, value));
  }
  if (key === "noise") {
    return Math.min(100, Math.max(0, value));
  }
  return value;
}

function bindParamInputs() {
  elements.freqRange.addEventListener("input", (event) => {
    handleParamChange("freq", Number(event.target.value));
  });
  elements.freqNumber.addEventListener("input", (event) => {
    handleParamChange("freq", Number(event.target.value));
  });
  elements.ampRange.addEventListener("input", (event) => {
    handleParamChange("amp", Number(event.target.value));
  });
  elements.ampNumber.addEventListener("input", (event) => {
    handleParamChange("amp", Number(event.target.value));
  });
  elements.noiseRange.addEventListener("input", (event) => {
    handleParamChange("noise", Number(event.target.value));
  });
  elements.noiseNumber.addEventListener("input", (event) => {
    handleParamChange("noise", Number(event.target.value));
  });
  elements.enableTremor.addEventListener("change", (event) => {
    state.params.enabled = event.target.checked;
    updateParamUI();
  });
}

function handleSend() {
  state.lastSent = { ...state.params };
  const now = new Date();
  state.lastSentAt = now.toISOString().slice(0, 19).replace("T", " ");
  updateParamUI();
  updateLastSentUI();
  void sendBluetoothCommand({ type: "params", params: { ...state.params } });
}

function handleStop() {
  state.params.enabled = false;
  state.params.amp = 0;
  updateParamUI();
  void sendBluetoothCommand({ type: "stop" });
}

function getTargetBufferLength() {
  const length = Math.round(state.visualization.sampleRate * state.visualization.windowSeconds);
  return Math.max(60, length);
}

function updateChartControls() {
  if (elements.windowRange) {
    elements.windowRange.value = String(state.visualization.windowSeconds);
  }
  if (elements.windowValue) {
    elements.windowValue.textContent = `${state.visualization.windowSeconds.toFixed(1)}s`;
  }
  if (elements.gainRange) {
    elements.gainRange.value = String(state.visualization.gain.toFixed(1));
  }
  if (elements.gainValue) {
    elements.gainValue.textContent = `${state.visualization.gain.toFixed(1)}x`;
  }
  if (elements.snapshotBtn) {
    elements.snapshotBtn.textContent = state.visualization.snapshot ? "Clear Snapshot" : "Capture Snapshot";
  }
}

// Visualization
function setupVisualization() {
  resizeCanvas(elements.tremorCanvas);
  window.addEventListener("resize", () => {
    resizeCanvas(elements.tremorCanvas);
    // Re-apply sidebar collapse state on resize to handle responsive changes
    applySidebarCollapse();
  });

  // Chart tooltip interactivity
  elements.chartContainer.addEventListener("mousemove", handleChartMouseMove);
  elements.chartContainer.addEventListener("mouseleave", handleChartMouseLeave);
  elements.chartContainer.addEventListener("focus", handleChartFocus);
  elements.chartContainer.addEventListener("blur", handleChartBlur);
  elements.chartContainer.addEventListener("keydown", handleChartKeydown);

  requestAnimationFrame(animate);
  window.setInterval(updateClinicalMetrics, 500);
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
}

let lastFrame = null;

function animate(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const delta = (timestamp - lastFrame) / 1000;
  lastFrame = timestamp;
  if (delta > 0) {
    const instantRate = 1 / delta;
    state.visualization.sampleRate =
      state.visualization.sampleRate * 0.9 + instantRate * 0.1;
  }
  if (elements.sampleRateValue) {
    elements.sampleRateValue.textContent = formatNumber(state.visualization.sampleRate, 1);
  }
  if (!state.visualization.freeze) {
    updateSignal(delta);
  }
  drawChart();
  drawSpectrum();
  requestAnimationFrame(animate);
}

function updateSignal(delta) {
  state.visualization.t += delta;
  if (isBluetoothStreaming()) return;
  const freq = state.params.freq;
  const amp = state.params.enabled ? state.params.amp : 0;
  const noise = state.params.noise;
  const signal = amp * Math.sin(2 * Math.PI * freq * state.visualization.t);
  const noiseVal = (Math.random() * 2 - 1) * noise * 0.35;
  const sample = signal + noiseVal;
  state.visualization.lastSample = sample;
  state.visualization.buffer.push(sample);
  const targetLength = getTargetBufferLength();
  while (state.visualization.buffer.length > targetLength) {
    state.visualization.buffer.shift();
  }
}

function drawChart() {
  const canvas = elements.tremorCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  // Get theme colors from CSS variables
  const style = getComputedStyle(document.documentElement);
  const chartPrimary = style.getPropertyValue("--chart-primary").trim() || "#0066ff";
  const chartSecondary = style.getPropertyValue("--chart-secondary").trim() || "#0891b2";
  const chartGrid = style.getPropertyValue("--chart-grid").trim() || "rgba(0, 0, 0, 0.1)";
  const chartGridStrong = chartGrid.replace(/0\.\d+\)$/, "0.2)") || "rgba(0, 0, 0, 0.2)";
  const chartGridFine = chartGrid.replace(/0\.\d+\)$/, "0.06)") || "rgba(0, 0, 0, 0.06)";
  const align = (value) => Math.round(value) + 0.5;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `${chartPrimary}15`);
  gradient.addColorStop(1, `${chartSecondary}08`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Draw fine grid lines
  ctx.strokeStyle = chartGridFine;
  ctx.lineWidth = 1;
  const fineY = 16;
  const fineX = 20;
  for (let i = 0; i <= fineY; i += 1) {
    const y = align((height / fineY) * i);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let i = 0; i <= fineX; i += 1) {
    const x = align((width / fineX) * i);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw grid lines
  ctx.strokeStyle = chartGrid;
  ctx.lineWidth = 1.2;

  // Horizontal grid lines
  const majorY = 4;
  const majorX = 6;
  for (let i = 0; i <= majorY; i++) {
    const y = align((height / majorY) * i);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical grid lines
  for (let i = 0; i <= majorX; i++) {
    const x = align((width / majorX) * i);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Center line
  ctx.strokeStyle = chartGridStrong;
  ctx.lineWidth = 2.2;
  const mid = height / 2;
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  const midY = align(mid);
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw signal
  const data = state.visualization.buffer;
  let maxAbs = 100;
  if (state.visualization.autoScale && data.length > 0) {
    maxAbs = data.reduce((max, value) => Math.max(max, Math.abs(value)), 1);
  }
  let scale = (height * 0.35) / maxAbs;
  scale *= state.visualization.gain;
  const maxAmp = (height * 0.35) / scale;

  // Normal band overlay removed for a cleaner waveform view

  // Glow effect
  ctx.shadowColor = chartPrimary;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = chartPrimary;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = mid - value * scale;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Snapshot overlay
  if (state.visualization.snapshot && state.visualization.snapshot.length > 1) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = chartSecondary;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    state.visualization.snapshot.forEach((value, index) => {
      const x = (index / (state.visualization.snapshot.length - 1)) * width;
      const y = mid - value * scale;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Reset shadow
  ctx.shadowBlur = 0;

  // Draw cursor indicator if hovering
  if (state.visualization.mouseX !== null) {
    const mouseX = state.visualization.mouseX;
    const ratio = window.devicePixelRatio || 1;
    const canvasX = mouseX * ratio;
    const index = Math.floor((canvasX / width) * data.length);

    if (index >= 0 && index < data.length) {
      const x = (index / (data.length - 1)) * width;
      const y = mid - data[index] * scale;

      // Vertical line
      ctx.strokeStyle = chartGridStrong;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point indicator
      ctx.fillStyle = chartPrimary;
      ctx.beginPath();
      ctx.arc(x, y, 6 * ratio, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 3 * ratio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Axis ticks removed for a cleaner waveform view
}

function drawSpectrum() {
  const canvas = elements.spectrumCanvas;
  if (!canvas) return;
  if (state.visualization.freezeSpectrum) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const style = getComputedStyle(document.documentElement);
  const chartSecondary = style.getPropertyValue("--chart-secondary").trim() || "#0891b2";
  const chartGrid = style.getPropertyValue("--chart-grid").trim() || "rgba(0, 0, 0, 0.06)";

  ctx.strokeStyle = chartGrid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const spectrum = calculateSpectrum(state.visualization.buffer, state.visualization.sampleRate);
  if (spectrum.length === 0) return;

  const band = spectrum.filter((bin) => bin.freq >= 2 && bin.freq <= 12);
  const maxMag = Math.max(...band.map((bin) => bin.mag), 1);

  ctx.strokeStyle = chartSecondary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  band.forEach((bin, index) => {
    const x = (index / (band.length - 1)) * width;
    const y = height - (bin.mag / maxMag) * (height * 0.9) - height * 0.05;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function handleChartMouseMove(event) {
  const rect = elements.chartContainer.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  state.visualization.usingKeyboard = false;
  state.visualization.mouseX = x;
  state.visualization.mouseY = y;

  const index = Math.floor((x / rect.width) * state.visualization.buffer.length);
  showChartTooltip(index, x, y, rect);
}

function handleChartMouseLeave() {
  if (state.visualization.usingKeyboard) return;
  clearChartSelection();
}

function handleChartFocus() {
  state.visualization.usingKeyboard = true;
  const rect = elements.chartContainer.getBoundingClientRect();
  const data = state.visualization.buffer;
  const midIndex = Math.floor(data.length / 2);
  state.visualization.keyboardIndex = midIndex;
  showChartTooltip(midIndex, null, null, rect);
}

function handleChartBlur() {
  clearChartSelection();
}

function handleChartKeydown(event) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();

  if (event.key === "Escape") {
    clearChartSelection();
    return;
  }

  const rect = elements.chartContainer.getBoundingClientRect();
  const data = state.visualization.buffer;
  let index = state.visualization.keyboardIndex ?? Math.floor(data.length / 2);

  if (event.key === "ArrowLeft") index -= 1;
  if (event.key === "ArrowRight") index += 1;
  if (event.key === "Home") index = 0;
  if (event.key === "End") index = data.length - 1;

  index = Math.max(0, Math.min(data.length - 1, index));
  state.visualization.keyboardIndex = index;
  state.visualization.usingKeyboard = true;
  showChartTooltip(index, null, null, rect);
}

function showChartTooltip(index, x, y, rect) {
  const data = state.visualization.buffer;
  if (index < 0 || index >= data.length) return;

  const amplitude = data[index];
  const phase = ((state.visualization.t * state.params.freq * 360) % 360).toFixed(1);
  const tooltip = elements.chartTooltip;

  const scale = (rect.height * 0.35) / 100;
  const plotX = (index / (data.length - 1)) * rect.width;
  const plotY = rect.height / 2 - amplitude * scale;
  const tooltipX = x ?? plotX;
  const tooltipY = y ?? plotY;

  const sampleRate = state.visualization.sampleRate || SIM_SAMPLE_RATE;
  const timeSeconds = sampleRate > 0 ? index / sampleRate : 0;
  const totalSeconds = sampleRate > 0 ? data.length / sampleRate : 0;
  $("#tooltipAmplitude").textContent = formatNumber(amplitude, 2);
  $("#tooltipTime").textContent = `${timeSeconds.toFixed(2)}s / ${totalSeconds.toFixed(2)}s`;
  $("#tooltipPhase").textContent = `${phase}°`;

  if (elements.chartLive) {
    elements.chartLive.textContent = `Amplitude ${formatNumber(amplitude, 2)}, time ${timeSeconds.toFixed(2)} seconds of ${totalSeconds.toFixed(2)}, phase ${phase} degrees.`;
  }

  let left = tooltipX + 15;
  let top = tooltipY - 10;

  if (left + 200 > rect.width) {
    left = tooltipX - 195;
  }
  if (top < 0) {
    top = tooltipY + 20;
  }
  const tooltipHeight = tooltip.offsetHeight || 0;
  if (tooltipHeight && top + tooltipHeight > rect.height) {
    top = Math.max(8, tooltipY - tooltipHeight - 12);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add("visible");
  tooltip.setAttribute("aria-hidden", "false");

  state.visualization.mouseX = plotX;
  state.visualization.mouseY = plotY;

}

function clearChartSelection() {
  state.visualization.mouseX = null;
  state.visualization.mouseY = null;
  state.visualization.keyboardIndex = null;
  state.visualization.usingKeyboard = false;
  elements.chartTooltip.classList.remove("visible");
  elements.chartTooltip.setAttribute("aria-hidden", "true");
  if (elements.chartLive) {
    elements.chartLive.textContent = "";
  }
}

// Clinical metrics calculation
function updateClinicalMetrics() {
  const buffer = state.visualization.buffer;
  const summary = calculateSummary(buffer);
  const rmsWindow = calculateWindowedRMS(buffer, 120);
  const spectrum = calculateSpectrum(buffer, state.visualization.sampleRate);
  const dominantFreq = calculateDominantFrequency(
    buffer,
    state.visualization.sampleRate
  );

  // Dominant frequency (FFT-based)
  state.clinicalMetrics.frequency = dominantFreq || state.params.freq;

  // RMS Amplitude (windowed)
  state.clinicalMetrics.rms = rmsWindow;

  // Peak-to-peak amplitude
  let minVal = 0;
  let maxVal = 0;
  if (buffer.length > 0) {
    minVal = buffer[0];
    maxVal = buffer[0];
    for (let i = 1; i < buffer.length; i += 1) {
      const v = buffer[i];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  state.clinicalMetrics.peakToPeak = maxVal - minVal;

  // Power Spectral Density (in dB)
  const power = rmsWindow > 0 ? 10 * Math.log10(rmsWindow * rmsWindow) : -40;
  state.clinicalMetrics.power = Math.max(-40, power);

  // Regularity Index (based on signal consistency)
  // Higher amplitude and lower noise = more regular
  const signalStrength = state.params.enabled ? state.params.amp : 0;
  const noiseLevel = state.params.noise;
  const regularity = signalStrength > 0
    ? Math.max(0, Math.min(100, 100 - (noiseLevel / signalStrength) * 50))
    : 0;
  state.clinicalMetrics.regularity = regularity;

  // Estimated UPDRS Score (0-4 scale based on amplitude)
  // 0 = None, 1 = Slight, 2 = Mild, 3 = Moderate, 4 = Severe
  let updrsScore = 0;
  if (rmsWindow > 5) updrsScore = 1;
  if (rmsWindow > 15) updrsScore = 2;
  if (rmsWindow > 30) updrsScore = 3;
  if (rmsWindow > 50) updrsScore = 4;
  state.clinicalMetrics.updrs = updrsScore;

  // Signal-to-Noise Ratio
  const signalPower = signalStrength * signalStrength;
  const noisePower = noiseLevel * noiseLevel * 0.1;
  const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 40;
  state.clinicalMetrics.snr = Math.max(-10, Math.min(40, snr));

  // Bandwidth (half-power width around dominant peak)
  state.clinicalMetrics.bandwidth = 0;
  if (spectrum.length > 0) {
    const band = spectrum.filter((bin) => bin.freq >= 3 && bin.freq <= 12);
    let peak = band[0];
    band.forEach((bin) => {
      if (bin.mag > peak.mag) peak = bin;
    });
    const threshold = peak.mag * 0.707;
    let left = peak.freq;
    let right = peak.freq;
    for (let i = 0; i < band.length; i += 1) {
      const bin = band[i];
      if (bin.freq < peak.freq && bin.mag <= threshold) {
        left = bin.freq;
      }
      if (bin.freq > peak.freq && bin.mag <= threshold) {
        right = bin.freq;
        break;
      }
    }
    state.clinicalMetrics.bandwidth = Math.max(0, right - left);
  }

  // Dominant frequency stability (coefficient of variation)
  const history = state.metricHistory.dominantFreq;
  if (state.clinicalMetrics.frequency > 0) {
    history.push(state.clinicalMetrics.frequency);
    if (history.length > 30) history.shift();
  }
  let stability = 0;
  if (history.length >= 5) {
    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
    const stdev = Math.sqrt(variance);
    const coefVar = mean > 0 ? stdev / mean : 1;
    stability = Math.max(0, Math.min(100, 100 - coefVar * 100));
  }
  state.clinicalMetrics.stability = stability;

  // Harmonic ratio (2nd + 3rd harmonics vs fundamental)
  let harmonicRatio = 0;
  if (spectrum.length > 0 && state.clinicalMetrics.frequency > 0) {
    const fundamental = state.clinicalMetrics.frequency;
    const findNearest = (target) => {
      let nearest = spectrum[0];
      let minDiff = Math.abs(nearest.freq - target);
      for (let i = 1; i < spectrum.length; i += 1) {
        const diff = Math.abs(spectrum[i].freq - target);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = spectrum[i];
        }
      }
      return nearest.mag;
    };
    const fundamentalMag = findNearest(fundamental);
    const h2 = findNearest(fundamental * 2);
    const h3 = findNearest(fundamental * 3);
    if (fundamentalMag > 0) {
      harmonicRatio = ((h2 + h3) / fundamentalMag) * 100;
    }
  }
  state.clinicalMetrics.harmonic = Math.max(0, Math.min(200, harmonicRatio));

  // Update UI
  updateClinicalMetricsUI();
}

function updateClinicalMetricsUI() {
  const m = state.clinicalMetrics;

  // Update values
  elements.metricFrequency.textContent = formatNumber(m.frequency, 2);
  elements.metricRMS.textContent = formatNumber(m.rms, 1);
  elements.metricPower.textContent = formatNumber(m.power, 1);
  elements.metricRegularity.textContent = formatNumber(m.regularity, 0);
  elements.metricUPDRS.textContent = m.updrs;
  elements.metricSNR.textContent = formatNumber(m.snr, 1);
  elements.metricPeakToPeak.textContent = formatNumber(m.peakToPeak, 1);
  elements.metricBandwidth.textContent = formatNumber(m.bandwidth, 2);
  elements.metricStability.textContent = formatNumber(m.stability, 0);
  elements.metricHarmonic.textContent = formatNumber(m.harmonic, 0);

  // Update indicators
  updateIndicator(elements.freqIndicator, m.frequency, 4, 6, 3, 8);
  updateIndicator(elements.rmsIndicator, m.rms, 0, 30, 0, 100);
  updateIndicator(elements.powerIndicator, m.power, -20, 10, -40, 30);
  updateIndicator(elements.regularityIndicator, m.regularity, 60, 100, 0, 100);
  updateIndicator(elements.updrsIndicator, m.updrs, 0, 1, 0, 4);
  updateIndicator(elements.snrIndicator, m.snr, 15, 40, -10, 40);
  updateIndicator(elements.peakToPeakIndicator, m.peakToPeak, 0, 60, 0, 120);
  updateIndicator(elements.bandwidthIndicator, m.bandwidth, 0, 2, 0, 6);
  updateIndicator(elements.stabilityIndicator, m.stability, 70, 100, 0, 100);
  updateIndicator(elements.harmonicIndicator, m.harmonic, 0, 60, 0, 150);
}

function updateIndicator(element, value, normalMin, normalMax, alertMin, alertMax) {
  if (!element) return;

  element.classList.remove("normal", "warning", "alert");

  if (value >= normalMin && value <= normalMax) {
    element.classList.add("normal");
  } else if (value < alertMin || value > alertMax) {
    element.classList.add("alert");
  } else {
    element.classList.add("warning");
  }
}

// Profile management
function renderProfiles() {
  elements.profileSelect.innerHTML = "";
  if (state.profiles.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No profiles available";
    option.disabled = true;
    option.selected = true;
    elements.profileSelect.appendChild(option);
  } else {
    state.profiles.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      elements.profileSelect.appendChild(option);
    });
  }

  elements.profilesTable.innerHTML = "";
  if (state.profiles.length === 0) {
    elements.profilesEmpty.classList.remove("hidden");
    return;
  }
  elements.profilesEmpty.classList.add("hidden");

  state.profiles.forEach((profile) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <th scope="row"><strong>${profile.name}</strong></th>
      <td>${formatDate(profile.updated)}</td>
      <td><span style="font-family: var(--font-mono)">${formatNumber(profile.freq, 0)}</span> Hz</td>
      <td><span style="font-family: var(--font-mono)">${Math.round(profile.amp)}</span></td>
      <td><span style="font-family: var(--font-mono)">${Math.round(profile.noise)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary" data-action="load" data-id="${profile.id}" aria-label="Load profile ${profile.name}">Load</button>
          <button class="btn btn-ghost" data-action="rename" data-id="${profile.id}" aria-label="Rename profile ${profile.name}">Rename</button>
          <button class="btn btn-ghost" data-action="duplicate" data-id="${profile.id}" aria-label="Copy profile ${profile.name}">Copy</button>
          <button class="btn btn-danger" data-action="delete" data-id="${profile.id}" aria-label="Delete profile ${profile.name}">Delete</button>
        </div>
      </td>
    `;
    elements.profilesTable.appendChild(row);
  });
}

function renderSequences() {
  elements.sequenceList.innerHTML = "";
  if (state.sequences.length === 0) {
    elements.sequencesEmpty.classList.remove("hidden");
  } else {
    elements.sequencesEmpty.classList.add("hidden");
  }

  state.sequences.forEach((sequence, index) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.setAttribute("role", "listitem");
    item.style.animationDelay = `${index * 0.05}s`;
    if (sequence.id === state.selectedSequenceId) {
      item.classList.add("active");
    }
    const totalDuration = sequence.steps.reduce((sum, step) => sum + Number(step.duration || 0), 0);
    item.innerHTML = `
      <div>
        <div class="list-title">${sequence.name}</div>
        <div class="list-sub">${sequence.steps.length} steps &middot; ${totalDuration}s total</div>
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost" data-action="edit" data-id="${sequence.id}" aria-label="Edit sequence ${sequence.name}">Edit</button>
        <button class="btn btn-secondary" data-action="play" data-id="${sequence.id}" aria-label="Play sequence ${sequence.name}">Play</button>
        <button class="btn btn-danger" data-action="delete" data-id="${sequence.id}" aria-label="Delete sequence ${sequence.name}">Delete</button>
      </div>
    `;
    elements.sequenceList.appendChild(item);
  });

  renderSequenceEditor();
}

function renderSequenceEditor() {
  const sequence = state.sequences.find((seq) => seq.id === state.selectedSequenceId);
  if (!sequence) {
    elements.sequenceEditor.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <h3>No Sequence Selected</h3>
        <p>Choose a sequence from the library to view and edit its steps.</p>
      </div>
    `;
    return;
  }

  const stepsHtml = sequence.steps
    .map((step, index) => {
      return `
        <div class="step-row" data-index="${index}" style="animation-delay: ${index * 0.05}s">
          <input type="number" min="1" step="1" value="${step.duration}" data-field="duration" data-index="${index}" placeholder="Duration" aria-label="Step ${index + 1} duration in seconds" />
          <input type="number" min="4" max="12" step="1" value="${step.freq}" data-field="freq" data-index="${index}" placeholder="Freq" aria-label="Step ${index + 1} frequency in hertz" />
          <input type="number" min="0" max="100" step="1" value="${step.amp}" data-field="amp" data-index="${index}" placeholder="Amp" aria-label="Step ${index + 1} amplitude" />
          <input type="number" min="0" max="100" step="1" value="${step.noise}" data-field="noise" data-index="${index}" placeholder="Noise" aria-label="Step ${index + 1} noise level" />
          <div class="step-actions">
            <button class="btn btn-ghost" data-action="up" data-index="${index}" aria-label="Move step ${index + 1} up">↑</button>
            <button class="btn btn-ghost" data-action="down" data-index="${index}" aria-label="Move step ${index + 1} down">↓</button>
            <button class="btn btn-danger" data-action="remove" data-index="${index}" aria-label="Remove step ${index + 1}">×</button>
          </div>
        </div>
      `;
    })
    .join("");

  const playback = state.playback;
  let statusText = "Stopped";
  let statusClass = "";
  if (playback.seqId === sequence.id) {
    const stepNumber = playback.stepIndex + 1;
    const step = sequence.steps[playback.stepIndex];
    const remaining = step ? Math.max(0, Math.round(step.duration - playback.elapsed)) : 0;
    statusText = playback.playing
      ? `Playing Step ${stepNumber}/${sequence.steps.length} — ${remaining}s remaining`
      : `Paused at Step ${stepNumber} — ${remaining}s remaining`;
    statusClass = playback.playing ? "recording" : "";
  }

  const syncInfo = state.sequenceSync[sequence.id];
  const syncText = syncInfo ? `Synced ${syncInfo.syncedAt}` : "Not synced";
  const deviceButtonsDisabled =
    state.connection.mode !== "bluetooth" || state.connection.status !== "connected"
      ? "disabled"
      : "";

  elements.sequenceEditor.innerHTML = `
    <div class="sequence-editor">
      <div class="field">
        <label for="sequenceName">Sequence Name</label>
        <input type="text" id="sequenceName" value="${sequence.name}" />
      </div>
      <div class="step-row" style="background: transparent; border: none; padding: 0 12px;">
        <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Duration (s)</div>
        <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Freq (Hz)</div>
        <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Amplitude</div>
        <div class="muted" style="font-size: 0.75rem; text-transform: uppercase;">Noise</div>
        <div></div>
      </div>
      ${stepsHtml}
      <button class="btn btn-secondary" id="addStepBtn">
        <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Step
      </button>
      <div class="sequence-status ${statusClass}">
        <div>
          <div class="label">Playback Status</div>
          <div class="muted" id="sequenceStatus">${statusText}</div>
        </div>
        <div class="button-row" style="margin-top: 0;">
          <button class="btn btn-primary" data-action="seq-play">
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Play
          </button>
          <button class="btn btn-secondary" data-action="seq-pause">
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
            Pause
          </button>
          <button class="btn btn-ghost" data-action="seq-stop">Stop</button>
        </div>
      </div>
      <div class="sequence-status">
        <div>
          <div class="label">Device Sync</div>
          <div class="muted" id="deviceSyncStatus">${syncText}</div>
        </div>
        <div class="button-row" style="margin-top: 0;">
          <button class="btn btn-secondary" data-action="device-sync" ${deviceButtonsDisabled}>Sync to Device</button>
          <button class="btn btn-primary" data-action="device-play" ${deviceButtonsDisabled}>Play on Device</button>
          <button class="btn btn-ghost" data-action="device-stop" ${deviceButtonsDisabled}>Stop Device</button>
        </div>
      </div>
    </div>
  `;
}

function renderSessions() {
  elements.sessionsTable.innerHTML = "";
  if (state.sessions.length === 0) {
    elements.sessionsEmpty.classList.remove("hidden");
    return;
  }
  elements.sessionsEmpty.classList.add("hidden");

  state.sessions.forEach((session) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <th scope="row"><strong>${session.name}</strong></th>
      <td>${session.start}</td>
      <td><span style="font-family: var(--font-mono)">${formatDuration(session.durationSec)}</span></td>
      <td><span style="font-family: var(--font-mono)">${session.sampleCount}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary" data-action="view" data-id="${session.id}" aria-label="View session ${session.name}">View</button>
          <button class="btn btn-danger" data-action="delete" data-id="${session.id}" aria-label="Delete session ${session.name}">Delete</button>
        </div>
      </td>
    `;
    elements.sessionsTable.appendChild(row);
  });
}

// Modal management
function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  activeModal = modal;
  lastFocusedElement = document.activeElement;
  if (elements.app) {
    elements.app.setAttribute("aria-hidden", "true");
  }
  const focusables = getFocusableElements(modal);
  if (focusables.length > 0) {
    focusables[0].focus();
  }
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  activeModal = null;
  if (elements.app) {
    elements.app.removeAttribute("aria-hidden");
  }
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

function getFocusableElements(container) {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");
  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

function bindModalEvents() {
  $$("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(elements.profileModal);
      closeModal(elements.sessionModal);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(elements.profileModal);
      closeModal(elements.sessionModal);
      return;
    }
    if (event.key !== "Tab" || !activeModal) return;
    const focusables = getFocusableElements(activeModal);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function updateQuickProfileSelection() {
  if (state.profiles.length > 0) {
    elements.profileSelect.value = state.profiles[0].id;
  }
}

function handleSaveProfile(event) {
  event.preventDefault();
  const name = elements.profileName.value.trim();
  if (!name) return;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const profile = {
    id: createId("profile"),
    name,
    updated: now,
    freq: state.params.freq,
    amp: state.params.amp,
    noise: state.params.noise
  };
  state.profiles.unshift(profile);
  persist();
  renderProfiles();
  updateQuickProfileSelection();
  closeModal(elements.profileModal);
  elements.profileForm.reset();
}

function handleProfileActions(event) {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) return;
  const profile = state.profiles.find((item) => item.id === id);
  if (!profile) return;

  if (action === "load") {
    state.params.freq = profile.freq;
    state.params.amp = profile.amp;
    state.params.noise = profile.noise;
    updateParamUI();
  }
  if (action === "rename") {
    const newName = window.prompt("Enter new profile name:", profile.name);
    if (newName && newName.trim()) {
      profile.name = newName.trim();
      profile.updated = new Date().toISOString().slice(0, 19).replace("T", " ");
    }
  }
  if (action === "duplicate") {
    const copy = {
      ...profile,
      id: createId("profile"),
      name: `${profile.name} (Copy)`,
      updated: new Date().toISOString().slice(0, 19).replace("T", " ")
    };
    state.profiles.unshift(copy);
  }
  if (action === "delete") {
    state.profiles = state.profiles.filter((item) => item.id !== id);
  }

  persist();
  renderProfiles();
}

function bindProfileEvents() {
  elements.saveProfileBtn.addEventListener("click", () => {
    elements.profileName.value = "";
    openModal(elements.profileModal);
    elements.profileName.focus();
  });

  elements.profileForm.addEventListener("submit", handleSaveProfile);

  elements.loadProfileBtn.addEventListener("click", () => {
    const selected = elements.profileSelect.value;
    const profile = state.profiles.find((item) => item.id === selected);
    if (!profile) return;
    state.params.freq = profile.freq;
    state.params.amp = profile.amp;
    state.params.noise = profile.noise;
    updateParamUI();
  });

  elements.profilesTable.addEventListener("click", handleProfileActions);
}

function bindSequenceEvents() {
  elements.newSequenceBtn.addEventListener("click", () => {
    const newSequence = {
      id: createId("sequence"),
      name: `Sequence ${state.sequences.length + 1}`,
      steps: [
        { duration: 10, freq: 5, amp: 40, noise: 10 },
        { duration: 10, freq: 6, amp: 50, noise: 12 }
      ]
    };
    state.sequences.unshift(newSequence);
    state.selectedSequenceId = newSequence.id;
    persist();
    renderSequences();
  });

  elements.sequenceList.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    const id = event.target.dataset.id;
    if (!action || !id) return;
    const sequence = state.sequences.find((item) => item.id === id);
    if (!sequence) return;

    if (action === "edit") {
      state.selectedSequenceId = id;
    }
    if (action === "play") {
      state.selectedSequenceId = id;
      startSequencePlayback(id);
    }
    if (action === "duplicate") {
      const copy = {
        ...sequence,
        id: createId("sequence"),
        name: `${sequence.name} (Copy)`,
        steps: sequence.steps.map((step) => ({ ...step }))
      };
      state.sequences.unshift(copy);
      state.selectedSequenceId = copy.id;
    }
    if (action === "delete") {
      state.sequences = state.sequences.filter((item) => item.id !== id);
      if (state.selectedSequenceId === id) {
        state.selectedSequenceId = null;
      }
    }
    persist();
    renderSequences();
  });

  elements.sequenceEditor.addEventListener("input", (event) => {
    const sequence = state.sequences.find((seq) => seq.id === state.selectedSequenceId);
    if (!sequence) return;

    if (event.target.id === "sequenceName") {
      sequence.name = event.target.value;
      persist();
      renderSequences();
      return;
    }

    const field = event.target.dataset.field;
    const index = Number(event.target.dataset.index);
    if (!field && Number.isNaN(index)) return;
    const step = sequence.steps[index];
    if (!step) return;
    step[field] = Number(event.target.value);
    persist();
  });

  elements.sequenceEditor.addEventListener("click", (event) => {
    const sequence = state.sequences.find((seq) => seq.id === state.selectedSequenceId);
    if (!sequence) return;

    if (event.target.id === "addStepBtn" || event.target.closest("#addStepBtn")) {
      sequence.steps.push({ duration: 10, freq: 5, amp: 40, noise: 10 });
      persist();
      renderSequences();
      return;
    }

    const action = event.target.dataset.action;
    const index = Number(event.target.dataset.index);
    if (action === "up" && index > 0) {
      [sequence.steps[index - 1], sequence.steps[index]] = [
        sequence.steps[index],
        sequence.steps[index - 1]
      ];
    }
    if (action === "down" && index < sequence.steps.length - 1) {
      [sequence.steps[index + 1], sequence.steps[index]] = [
        sequence.steps[index],
        sequence.steps[index + 1]
      ];
    }
    if (action === "remove") {
      sequence.steps.splice(index, 1);
    }
    if (action === "seq-play") {
      startSequencePlayback(sequence.id);
    }
    if (action === "seq-pause") {
      pauseSequencePlayback();
    }
    if (action === "seq-stop") {
      stopSequencePlayback();
    }
    if (action === "device-sync") {
      syncSequenceToDevice(sequence);
    }
    if (action === "device-play") {
      playSequenceOnDevice(sequence);
    }
    if (action === "device-stop") {
      stopSequenceOnDevice();
    }
    persist();
    renderSequences();
  });
}

function startSequencePlayback(sequenceId) {
  const sequence = state.sequences.find((seq) => seq.id === sequenceId);
  if (!sequence || sequence.steps.length === 0) return;
  if (state.playback.seqId === sequenceId && !state.playback.playing) {
    state.playback.playing = true;
    renderSequenceEditor();
    return;
  }
  stopSequencePlayback();
  state.playback.seqId = sequenceId;
  state.playback.stepIndex = 0;
  state.playback.elapsed = 0;
  state.playback.playing = true;
  applyStep(sequence.steps[0]);
  state.playback.intervalId = window.setInterval(() => {
    if (!state.playback.playing) return;
    const currentStep = sequence.steps[state.playback.stepIndex];
    state.playback.elapsed += 0.2;
    if (state.playback.elapsed >= currentStep.duration) {
      state.playback.stepIndex += 1;
      state.playback.elapsed = 0;
      if (state.playback.stepIndex >= sequence.steps.length) {
        stopSequencePlayback();
        return;
      }
      applyStep(sequence.steps[state.playback.stepIndex]);
    }
    renderSequenceEditor();
  }, 200);
  renderSequenceEditor();
}

function pauseSequencePlayback() {
  if (!state.playback.intervalId) return;
  state.playback.playing = false;
  renderSequenceEditor();
}

function stopSequencePlayback() {
  if (state.playback.intervalId) {
    clearInterval(state.playback.intervalId);
  }
  state.playback.intervalId = null;
  state.playback.seqId = null;
  state.playback.playing = false;
  state.playback.stepIndex = 0;
  state.playback.elapsed = 0;
  renderSequenceEditor();
}

function applyStep(step) {
  state.params.freq = step.freq;
  state.params.amp = step.amp;
  state.params.noise = step.noise;
  state.params.enabled = true;
  updateParamUI();
}

async function syncSequenceToDevice(sequence) {
  if (!sequence) return;
  if (state.connection.mode !== "bluetooth" || state.connection.status !== "connected") {
    window.alert("Connect to a Bluetooth device before syncing sequences.");
    return;
  }
  await sendBluetoothCommand({
    type: "sequence-save",
    sequence: {
      id: sequence.id,
      name: sequence.name,
      steps: sequence.steps
    }
  });
  const now = new Date();
  state.sequenceSync[sequence.id] = {
    syncedAt: now.toISOString().slice(0, 19).replace("T", " ")
  };
  renderSequenceEditor();
}

async function playSequenceOnDevice(sequence) {
  if (!sequence) return;
  if (state.connection.mode !== "bluetooth" || state.connection.status !== "connected") {
    window.alert("Connect to a Bluetooth device before playing sequences.");
    return;
  }
  await sendBluetoothCommand({ type: "sequence-play", id: sequence.id });
}

async function stopSequenceOnDevice() {
  if (state.connection.mode !== "bluetooth" || state.connection.status !== "connected") {
    window.alert("Connect to a Bluetooth device before stopping sequences.");
    return;
  }
  await sendBluetoothCommand({ type: "sequence-stop" });
}

function bindSessionEvents() {
  elements.sessionsTable.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    const id = event.target.dataset.id;
    if (!action || !id) return;
    if (action === "view") {
      openSessionModal(id);
    }
    if (action === "delete") {
      state.sessions = state.sessions.filter((session) => session.id !== id);
      persist();
      renderSessions();
    }
  });

  elements.deleteSessionBtn.addEventListener("click", () => {
    if (!elements.deleteSessionBtn.dataset.id) return;
    const id = elements.deleteSessionBtn.dataset.id;
    state.sessions = state.sessions.filter((session) => session.id !== id);
    persist();
    renderSessions();
    closeModal(elements.sessionModal);
  });

  elements.exportCsvBtn.addEventListener("click", () => {
    const id = elements.deleteSessionBtn.dataset.id;
    const session = state.sessions.find((s) => s.id === id);
    if (session) {
      exportSessionCSV(session);
    }
  });

  elements.exportJsonBtn.addEventListener("click", () => {
    const id = elements.deleteSessionBtn.dataset.id;
    const session = state.sessions.find((s) => s.id === id);
    if (session) {
      exportSessionJSON(session);
    }
  });
}

function exportSessionCSV(session) {
  const headers = ["Index", "Amplitude"];
  const rows = session.samples.map((sample, i) => `${i},${sample.toFixed(4)}`);
  const csv = [headers.join(","), ...rows].join("\n");
  downloadFile(`${session.name.replace(/\s+/g, "_")}.csv`, csv, "text/csv");
}

function exportSessionJSON(session) {
  const data = {
    name: session.name,
    start: session.start,
    duration: session.durationSec,
    sampleCount: session.sampleCount,
    summary: session.summary,
    samples: session.samples
  };
  const json = JSON.stringify(data, null, 2);
  downloadFile(`${session.name.replace(/\s+/g, "_")}.json`, json, "application/json");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openSessionModal(id) {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;

  const avgFreq = state.params.freq.toFixed(1);

  elements.sessionSummary.innerHTML = `
    <div class="summary-card">
      <span>Duration</span>
      <strong>${formatDuration(session.durationSec)}</strong>
    </div>
    <div class="summary-card">
      <span>Samples</span>
      <strong>${session.sampleCount}</strong>
    </div>
    <div class="summary-card">
      <span>RMS Amplitude</span>
      <strong>${formatNumber(session.summary.rms, 1)}</strong>
    </div>
    <div class="summary-card">
      <span>Peak Value</span>
      <strong>${formatNumber(session.summary.peak, 1)}</strong>
    </div>
    <div class="summary-card">
      <span>Avg Frequency</span>
      <strong>${avgFreq} Hz</strong>
    </div>
    <div class="summary-card">
      <span>Noise Level</span>
      <strong>${formatNumber(session.summary.noise, 1)}</strong>
    </div>
  `;
  elements.deleteSessionBtn.dataset.id = id;
  openModal(elements.sessionModal);

  // Draw chart after modal is visible
  setTimeout(() => drawSessionChart(session.samples), 50);
}

function drawSessionChart(samples) {
  const canvas = elements.sessionCanvas;
  resizeCanvas(canvas);
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  // Get theme colors
  const style = getComputedStyle(document.documentElement);
  const chartSecondary = style.getPropertyValue("--chart-secondary").trim() || "#0891b2";

  // Background
  ctx.fillStyle = `${chartSecondary}10`;
  ctx.fillRect(0, 0, width, height);

  if (!samples || samples.length === 0) return;

  const mid = height / 2;
  const scale = (height * 0.35) / 100;

  // Glow effect
  ctx.shadowColor = chartSecondary;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = chartSecondary;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  samples.forEach((value, index) => {
    const x = (index / (samples.length - 1)) * width;
    const y = mid - value * scale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// Settings
function bindSettingsEvents() {
  const darkModeToggle = $("#settingDarkMode");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("change", (event) => {
      state.theme = event.target.checked ? "dark" : "light";
      applyTheme();
    });
  }
  if (elements.settingHighContrast) {
    elements.settingHighContrast.addEventListener("change", (event) => {
      state.contrast = event.target.checked ? "high" : "normal";
      applyContrast();
    });
  }
}

// Initialize
function init() {
  bindElements();
  loadData();
  initTheme();
  initContrast();
  initSidebarCollapse();

  initTabs();
  initSidebarToggle();

  // Sidebar collapse toggle (desktop)
  elements.sidebarToggle.addEventListener("click", toggleSidebarCollapse);
  bindParamInputs();
  bindProfileEvents();
  bindSequenceEvents();
  bindSessionEvents();
  bindModalEvents();
  bindSettingsEvents();

  // Theme toggle
  elements.themeToggle.addEventListener("click", toggleTheme);

  updateBluetoothOptionState();
  elements.connectionMode.addEventListener("change", handleConnectionModeChange);

  elements.connectBtn.addEventListener("click", handleConnectClick);
  elements.pingBtn.addEventListener("click", handlePingClick);
  if (elements.latencyTestBtn) {
    elements.latencyTestBtn.addEventListener("click", toggleLatencyTest);
  }

  elements.logToggleBtn.addEventListener("click", () => setLogging(!state.logging));
  elements.sidebarLogBtn.addEventListener("click", () => setLogging(!state.logging));
  elements.sessionsLogBtn.addEventListener("click", () => setLogging(!state.logging));

  elements.sendBtn.addEventListener("click", handleSend);
  elements.stopBtn.addEventListener("click", handleStop);

  elements.freezeBtn.addEventListener("click", () => {
    state.visualization.freeze = !state.visualization.freeze;
    const icon = state.visualization.freeze
      ? '<polygon points="5 3 19 12 5 21 5 3"/>'
      : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    elements.freezeBtn.innerHTML = `
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </svg>
      ${state.visualization.freeze ? "Resume" : "Freeze"}
    `;
  });

  elements.clearBtn.addEventListener("click", () => {
    state.visualization.buffer = new Array(getTargetBufferLength()).fill(0);
  });

  if (elements.snapshotBtn) {
    elements.snapshotBtn.addEventListener("click", () => {
      if (state.visualization.snapshot) {
        state.visualization.snapshot = null;
      } else {
        state.visualization.snapshot = state.visualization.buffer.slice();
      }
      updateChartControls();
    });
  }

  if (elements.windowRange) {
    elements.windowRange.addEventListener("input", (event) => {
      state.visualization.windowSeconds = Number(event.target.value);
      const targetLength = getTargetBufferLength();
      while (state.visualization.buffer.length > targetLength) {
        state.visualization.buffer.shift();
      }
      updateChartControls();
    });
  }

  if (elements.gainRange) {
    elements.gainRange.addEventListener("input", (event) => {
      state.visualization.gain = Number(event.target.value);
      updateChartControls();
    });
  }

  if (elements.spectrumFreezeBtn) {
    elements.spectrumFreezeBtn.addEventListener("click", () => {
      state.visualization.freezeSpectrum = !state.visualization.freezeSpectrum;
      const label = state.visualization.freezeSpectrum ? "Resume Spectrum" : "Freeze Spectrum";
      elements.spectrumFreezeBtn.textContent = label;
      elements.spectrumFreezeBtn.setAttribute(
        "aria-pressed",
        state.visualization.freezeSpectrum ? "true" : "false"
      );
    });
  }

  updateParamUI();
  updateLastSentUI();
  updateConnectionUI();
  renderProfiles();
  renderSequences();
  renderSessions();
  updateQuickProfileSelection();
  updateChartControls();
  state.visualization.buffer = new Array(getTargetBufferLength()).fill(0);
  setupVisualization();
}

document.addEventListener("DOMContentLoaded", init);
