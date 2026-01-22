/* global window, document */

const STORAGE_KEY = "tremor-sim-platform";

const seedProfiles = [
  { id: "p1", name: "Clinical Baseline", updated: "2024-03-14 09:12", freq: 4.2, amp: 35, noise: 12 },
  { id: "p2", name: "High Frequency", updated: "2024-03-18 15:44", freq: 7.1, amp: 52, noise: 18 },
  { id: "p3", name: "Low Noise", updated: "2024-03-21 11:05", freq: 3.6, amp: 28, noise: 6 }
];

const seedSequences = [
  {
    id: "s1",
    name: "Ramp Cycle",
    steps: [
      { duration: 8, freq: 4.0, amp: 25, noise: 8 },
      { duration: 10, freq: 5.5, amp: 45, noise: 12 },
      { duration: 6, freq: 3.8, amp: 30, noise: 10 }
    ]
  }
];

const seedSessions = [
  createSessionSeed("Morning Calibration", "2024-03-20 08:02", 420, 2100, 4.6, 42),
  createSessionSeed("Therapy Trial A", "2024-03-21 16:28", 300, 1800, 5.1, 48)
];

const state = {
  connection: {
    mode: "mock",
    status: "disconnected",
    latency: null,
    per: null
  },
  params: {
    freq: 4.5,
    amp: 40,
    noise: 12,
    enabled: true
  },
  lastSent: {
    freq: 4.5,
    amp: 40,
    noise: 12,
    enabled: true
  },
  lastSentAt: null,
  profiles: [],
  sequences: [],
  sessions: [],
  selectedSequenceId: null,
  logging: false,
  activeSession: null,
  visualization: {
    buffer: new Array(300).fill(0),
    t: 0,
    freeze: false,
    lastSample: 0
  },
  playback: {
    intervalId: null,
    seqId: null,
    stepIndex: 0,
    elapsed: 0,
    playing: false
  }
};

const elements = {};

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
  return {
    avg,
    rms,
    peak,
    noise
  };
}

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

function bindElements() {
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

  elements.connectionMode = $("#connectionMode");
  elements.connectBtn = $("#connectBtn");
  elements.pingBtn = $("#pingBtn");
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
  elements.readoutFreq = $("#readoutFreq");
  elements.readoutRms = $("#readoutRms");
  elements.readoutNoise = $("#readoutNoise");

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
}

function initTabs() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      elements.tabs.forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      elements.panels.forEach((panel) => {
        if (panel.id === `tab-${target}`) {
          panel.classList.remove("hidden");
          panel.classList.add("active");
        } else {
          panel.classList.add("hidden");
          panel.classList.remove("active");
        }
      });
      elements.pageTitle.textContent = tab.textContent;
      setSidebarOpen(false);
    });
  });
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
}

function initSidebarToggle() {
  const toggle = () => {
    const isOpen = elements.sidebar.classList.contains("open");
    setSidebarOpen(!isOpen);
  };
  elements.sidebarToggle.addEventListener("click", toggle);
  elements.mobileNavToggle.addEventListener("click", toggle);
  elements.sidebarOverlay.addEventListener("click", () => setSidebarOpen(false));
}

function updateConnectionUI() {
  const status = state.connection.status;
  elements.connectionStatusPill.textContent = capitalize(status);
  elements.connectionStatusPill.dataset.status = status;
  elements.topStatusPill.textContent = capitalize(status);
  elements.topStatusPill.dataset.status = status;

  elements.sidebarStatusText.textContent = capitalize(status);
  elements.sidebarStatusDot.style.background = statusColor(status);

  elements.connectBtn.textContent = status === "connected" ? "Disconnect" : "Connect";
  elements.connectBtn.disabled = status === "connecting";

  const latency = state.connection.latency;
  const per = state.connection.per;
  elements.latencyValue.textContent = formatNumber(latency, 0);
  elements.perValue.textContent = formatNumber(per, 2);
  elements.topLatency.textContent = formatNumber(latency, 0);
  elements.topPer.textContent = formatNumber(per, 2);

  if (elements.healthMode) {
    elements.healthMode.textContent =
      state.connection.mode === "mock" ? "Mock" : capitalize(state.connection.mode);
  }
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

let connectTimer = null;
let metricsTimer = null;

function updateMetrics() {
  state.connection.latency = Math.round(randomBetween(10, 80));
  state.connection.per = Number(randomBetween(0, 0.5).toFixed(2));
  updateConnectionUI();
}

function handleConnectClick() {
  if (state.connection.status === "connected") {
    state.connection.status = "disconnected";
    state.connection.latency = null;
    state.connection.per = null;
    updateConnectionUI();
    if (metricsTimer) {
      clearInterval(metricsTimer);
      metricsTimer = null;
    }
    return;
  }
  if (state.connection.status === "connecting") {
    return;
  }
  state.connection.status = "connecting";
  updateConnectionUI();
  if (connectTimer) {
    clearTimeout(connectTimer);
  }
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

function setLogging(enabled) {
  state.logging = enabled;
  elements.loggingStatus.textContent = enabled ? "On" : "Off";
  const label = enabled ? "Stop Logging" : "Start Logging";
  elements.logToggleBtn.textContent = label;
  elements.sidebarLogBtn.textContent = label;
  elements.sessionsLogBtn.textContent = label;

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

function updateParamUI() {
  elements.freqRange.value = state.params.freq;
  elements.freqNumber.value = state.params.freq.toFixed(1);
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
    return Math.min(8, Math.max(3, value));
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
}

function handleStop() {
  state.params.enabled = false;
  state.params.amp = 0;
  updateParamUI();
}

function setupVisualization() {
  resizeCanvas(elements.tremorCanvas);
  window.addEventListener("resize", () => resizeCanvas(elements.tremorCanvas));
  requestAnimationFrame(animate);
  window.setInterval(updateReadouts, 600);
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
  if (!state.visualization.freeze) {
    updateSignal(delta);
  }
  drawChart();
  requestAnimationFrame(animate);
}

function updateSignal(delta) {
  state.visualization.t += delta;
  const freq = state.params.freq;
  const amp = state.params.enabled ? state.params.amp : 0;
  const noise = state.params.noise;
  const signal = amp * Math.sin(2 * Math.PI * freq * state.visualization.t);
  const noiseVal = (Math.random() * 2 - 1) * noise * 0.35;
  const sample = signal + noiseVal;
  state.visualization.lastSample = sample;
  state.visualization.buffer.push(sample);
  if (state.visualization.buffer.length > 300) {
    state.visualization.buffer.shift();
  }
}

function drawChart() {
  const canvas = elements.tremorCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(11, 95, 255, 0.12)");
  gradient.addColorStop(1, "rgba(20, 133, 140, 0.08)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 1;
  const mid = height / 2;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();

  const data = state.visualization.buffer;
  const scale = (height * 0.35) / 100;
  ctx.strokeStyle = "rgba(11, 95, 255, 0.9)";
  ctx.lineWidth = 2;
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
}

function updateReadouts() {
  const rms = calculateSummary(state.visualization.buffer).rms;
  const freq = state.params.freq + randomBetween(-0.08, 0.08);
  const noise = state.params.noise + randomBetween(-1, 1);
  elements.readoutFreq.textContent = formatNumber(freq, 2);
  elements.readoutRms.textContent = formatNumber(rms, 1);
  elements.readoutNoise.textContent = formatNumber(noise, 1);
}

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
      <td>${profile.name}</td>
      <td>${formatDate(profile.updated)}</td>
      <td>${formatNumber(profile.freq, 1)} Hz</td>
      <td>${Math.round(profile.amp)}</td>
      <td>${Math.round(profile.noise)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary" data-action="load" data-id="${profile.id}">Load</button>
          <button class="btn btn-ghost" data-action="rename" data-id="${profile.id}">Rename</button>
          <button class="btn btn-ghost" data-action="duplicate" data-id="${profile.id}">Duplicate</button>
          <button class="btn btn-danger" data-action="delete" data-id="${profile.id}">Delete</button>
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

  state.sequences.forEach((sequence) => {
    const item = document.createElement("div");
    item.className = "list-item";
    if (sequence.id === state.selectedSequenceId) {
      item.classList.add("active");
    }
    const totalDuration = sequence.steps.reduce((sum, step) => sum + Number(step.duration || 0), 0);
    item.innerHTML = `
      <div>
        <div class="list-title">${sequence.name}</div>
        <div class="list-sub">${sequence.steps.length} steps - ${totalDuration}s</div>
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost" data-action="edit" data-id="${sequence.id}">Edit</button>
        <button class="btn btn-secondary" data-action="play" data-id="${sequence.id}">Play</button>
        <button class="btn btn-ghost" data-action="duplicate" data-id="${sequence.id}">Duplicate</button>
        <button class="btn btn-danger" data-action="delete" data-id="${sequence.id}">Delete</button>
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
        <h3>No sequence selected</h3>
        <p>Choose a sequence from the library to edit steps.</p>
      </div>
    `;
    return;
  }

  const stepsHtml = sequence.steps
    .map((step, index) => {
      return `
        <div class="step-row" data-index="${index}">
          <input type="number" min="1" step="1" value="${step.duration}" data-field="duration" data-index="${index}" />
          <input type="number" min="3" max="8" step="0.1" value="${step.freq}" data-field="freq" data-index="${index}" />
          <input type="number" min="0" max="100" step="1" value="${step.amp}" data-field="amp" data-index="${index}" />
          <input type="number" min="0" max="100" step="1" value="${step.noise}" data-field="noise" data-index="${index}" />
          <div class="step-actions">
            <button class="btn btn-ghost" data-action="up" data-index="${index}">Up</button>
            <button class="btn btn-ghost" data-action="down" data-index="${index}">Down</button>
            <button class="btn btn-danger" data-action="remove" data-index="${index}">Remove</button>
          </div>
        </div>
      `;
    })
    .join("");

  const playback = state.playback;
  let statusText = "Stopped";
  if (playback.seqId === sequence.id) {
    const stepNumber = playback.stepIndex + 1;
    const step = sequence.steps[playback.stepIndex];
    const remaining = step ? Math.max(0, Math.round(step.duration - playback.elapsed)) : 0;
    statusText = playback.playing
      ? `Playing - Step ${stepNumber} - ${remaining}s remaining`
      : `Paused - Step ${stepNumber} - ${remaining}s remaining`;
  }

  elements.sequenceEditor.innerHTML = `
    <div class="sequence-editor">
      <div class="field">
        <label for="sequenceName">Sequence name</label>
        <input type="text" id="sequenceName" value="${sequence.name}" />
      </div>
      <div class="step-row" style="background: transparent; border: none; padding: 0;">
        <div class="muted">Duration (sec)</div>
        <div class="muted">Freq</div>
        <div class="muted">Amp</div>
        <div class="muted">Noise</div>
        <div></div>
      </div>
      ${stepsHtml}
      <button class="btn btn-secondary" id="addStepBtn">Add step</button>
      <div class="sequence-status">
        <div>
          <div class="label">Playback</div>
          <div class="muted" id="sequenceStatus">${statusText}</div>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" data-action="seq-play">Play</button>
          <button class="btn btn-secondary" data-action="seq-pause">Pause</button>
          <button class="btn btn-ghost" data-action="seq-stop">Stop</button>
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
      <td>${session.name}</td>
      <td>${session.start}</td>
      <td>${formatDuration(session.durationSec)}</td>
      <td>${session.sampleCount}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary" data-action="view" data-id="${session.id}">View</button>
          <button class="btn btn-danger" data-action="delete" data-id="${session.id}">Delete</button>
        </div>
      </td>
    `;
    elements.sessionsTable.appendChild(row);
  });
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function bindModalEvents() {
  $$('[data-close-modal]').forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(elements.profileModal);
      closeModal(elements.sessionModal);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(elements.profileModal);
      closeModal(elements.sessionModal);
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
    const newName = window.prompt("Rename profile", profile.name);
    if (newName) {
      profile.name = newName;
      profile.updated = new Date().toISOString().slice(0, 19).replace("T", " ");
    }
  }
  if (action === "duplicate") {
    const copy = {
      ...profile,
      id: createId("profile"),
      name: `${profile.name} Copy`,
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
        { duration: 6, freq: 4.0, amp: 30, noise: 10 },
        { duration: 6, freq: 5.2, amp: 45, noise: 12 }
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
        name: `${sequence.name} Copy`,
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

    if (event.target.id === "addStepBtn") {
      sequence.steps.push({ duration: 6, freq: 4.5, amp: 35, noise: 10 });
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
    window.alert("Mock export: CSV prepared.");
  });

  elements.exportJsonBtn.addEventListener("click", () => {
    window.alert("Mock export: JSON prepared.");
  });
}

function openSessionModal(id) {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  elements.sessionSummary.innerHTML = `
    <div class="summary-card"><span>Duration</span><strong>${formatDuration(session.durationSec)}</strong></div>
    <div class="summary-card"><span>Samples</span><strong>${session.sampleCount}</strong></div>
    <div class="summary-card"><span>RMS</span><strong>${formatNumber(session.summary.rms, 1)}</strong></div>
    <div class="summary-card"><span>Peak</span><strong>${formatNumber(session.summary.peak, 1)}</strong></div>
  `;
  elements.deleteSessionBtn.dataset.id = id;
  openModal(elements.sessionModal);
  drawSessionChart(session.samples);
}

function drawSessionChart(samples) {
  const canvas = elements.sessionCanvas;
  resizeCanvas(canvas);
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(11, 95, 255, 0.08)";
  ctx.fillRect(0, 0, width, height);
  if (!samples || samples.length === 0) return;
  const mid = height / 2;
  const scale = (height * 0.35) / 100;
  ctx.strokeStyle = "rgba(20, 133, 140, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((value, index) => {
    const x = (index / (samples.length - 1)) * width;
    const y = mid - value * scale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function init() {
  bindElements();
  loadData();

  initTabs();
  initSidebarToggle();
  bindParamInputs();
  bindProfileEvents();
  bindSequenceEvents();
  bindSessionEvents();
  bindModalEvents();

  elements.connectionMode.addEventListener("change", (event) => {
    state.connection.mode = event.target.value;
    updateConnectionUI();
  });

  elements.connectBtn.addEventListener("click", handleConnectClick);
  elements.pingBtn.addEventListener("click", updateMetrics);

  elements.logToggleBtn.addEventListener("click", () => setLogging(!state.logging));
  elements.sidebarLogBtn.addEventListener("click", () => setLogging(!state.logging));
  elements.sessionsLogBtn.addEventListener("click", () => setLogging(!state.logging));

  elements.sendBtn.addEventListener("click", handleSend);
  elements.stopBtn.addEventListener("click", handleStop);
  elements.freezeBtn.addEventListener("click", () => {
    state.visualization.freeze = !state.visualization.freeze;
    elements.freezeBtn.textContent = state.visualization.freeze ? "Resume" : "Freeze";
  });
  elements.clearBtn.addEventListener("click", () => {
    state.visualization.buffer = new Array(300).fill(0);
  });

  updateParamUI();
  updateLastSentUI();
  updateConnectionUI();
  renderProfiles();
  renderSequences();
  renderSessions();
  updateQuickProfileSelection();
  setupVisualization();
}

document.addEventListener("DOMContentLoaded", init);
