/* global window, document */

import { seedProfiles, seedSequences, seedSessions } from "./state/seedData.js";
import { loadStoredData } from "./services/storage/storageService.js";
import type { AppState } from "./state/types.js";
import { shallowEqualArray, shallowEqualObject, type Store } from "./state/store.js";
import type { Elements } from "./ui/elements.js";
import { updateLastSentUI, updateParamUI, updateRangeFill } from "./ui/paramUi.js";
import { bindParamInputs, bindSettingsEvents } from "./ui/bindEvents.js";
import type { BluetoothService } from "./services/bluetooth/bluetoothService.js";
import type { MockConnectionService } from "./services/mock/mockConnectionService.js";
import type { MockTelemetryService } from "./services/mock/mockTelemetryService.js";
import type { ConnectionView } from "./views/connectionView.js";
import type { ModalManager } from "./views/modalManager.js";
import type { TabsView } from "./views/tabsView.js";
import type { ThemeView } from "./views/themeView.js";
import type { SidebarView } from "./views/sidebarView.js";
import type { VisualizationView } from "./views/visualizationView.js";
import type { ProfilesView } from "./views/profilesView.js";
import type { SequencesView } from "./views/sequencesView.js";
import type { SessionsView } from "./views/sessionsView.js";
import type { ConnectionViewModel } from "./viewmodels/connectionViewModel.js";
import type { ParamsViewModel } from "./viewmodels/paramsViewModel.js";
import type { VisualizationViewModel } from "./viewmodels/visualizationViewModel.js";
import type { SessionsViewModel } from "./viewmodels/sessionsViewModel.js";
import type { ProfilesViewModel } from "./viewmodels/profilesViewModel.js";
import type { SequencesViewModel } from "./viewmodels/sequencesViewModel.js";

/**
 * Tremor Monitor Pro - Clinical Dashboard
 * Professional Parkinson's Disease Tremor Analysis Software
 */

let store!: Store<AppState>;
let state!: AppState;
let elements!: Elements;
let connectionView!: ConnectionView;
let modalManager!: ModalManager;
let tabsView!: TabsView;
let themeView!: ThemeView;
let sidebarView!: SidebarView;
let visualizationView!: VisualizationView;
let profilesView!: ProfilesView;
let sequencesView!: SequencesView;
let sessionsView!: SessionsView;
let connectionViewModel!: ConnectionViewModel;
let paramsViewModel!: ParamsViewModel;
let visualizationViewModel!: VisualizationViewModel;
let sessionsViewModel!: SessionsViewModel;
let profilesViewModel!: ProfilesViewModel;
let sequencesViewModel!: SequencesViewModel;
let mockTelemetry!: MockTelemetryService;
let bluetoothService!: BluetoothService;
let mockConnection!: MockConnectionService;

export type AppDependencies = {
  store: Store<AppState>;
  elements: Elements;
  bluetoothService: BluetoothService;
  mockConnection: MockConnectionService;
  mockTelemetry: MockTelemetryService;
  connectionView: ConnectionView;
  modalManager: ModalManager;
  tabsView: TabsView;
  themeView: ThemeView;
  sidebarView: SidebarView;
  visualizationView: VisualizationView;
  profilesView: ProfilesView;
  sequencesView: SequencesView;
  sessionsView: SessionsView;
  connectionViewModel: ConnectionViewModel;
  paramsViewModel: ParamsViewModel;
  visualizationViewModel: VisualizationViewModel;
  sessionsViewModel: SessionsViewModel;
  profilesViewModel: ProfilesViewModel;
  sequencesViewModel: SequencesViewModel;
};

export function configureApp(deps: AppDependencies) {
  store = deps.store;
  state = deps.store.getState();
  elements = deps.elements;
  bluetoothService = deps.bluetoothService;
  mockConnection = deps.mockConnection;
  mockTelemetry = deps.mockTelemetry;
  connectionView = deps.connectionView;
  modalManager = deps.modalManager;
  tabsView = deps.tabsView;
  themeView = deps.themeView;
  sidebarView = deps.sidebarView;
  visualizationView = deps.visualizationView;
  profilesView = deps.profilesView;
  sequencesView = deps.sequencesView;
  sessionsView = deps.sessionsView;
  connectionViewModel = deps.connectionViewModel;
  paramsViewModel = deps.paramsViewModel;
  visualizationViewModel = deps.visualizationViewModel;
  sessionsViewModel = deps.sessionsViewModel;
  profilesViewModel = deps.profilesViewModel;
  sequencesViewModel = deps.sequencesViewModel;
}

// Data persistence
function loadData() {
  const parsed = loadStoredData();
  if (parsed) {
    const stored = parsed as any;
    store.update((state) => {
      state.profiles = stored.profiles || seedProfiles;
      state.sequences = stored.sequences || seedSequences;
      state.sessions = stored.sessions || seedSessions;
    });
    return;
  }
  store.update((state) => {
    state.profiles = seedProfiles;
    state.sequences = seedSequences;
    state.sessions = seedSessions;
  });
}

// Tab navigation
// Connection handling

function getTargetBufferLength() {
  const length = Math.round(state.visualization.sampleRate * state.visualization.windowSeconds);
  return Math.max(60, length);
}

// Initialize
export function initApp() {
  if (!document.querySelector(".theme-fade")) {
    const fade = document.createElement("div");
    fade.className = "theme-fade";
    fade.setAttribute("aria-hidden", "true");
    document.body.appendChild(fade);
  }

  store.subscribeSelector(
    (current) => current.profiles,
    () => {
      profilesViewModel?.renderProfiles();
      profilesViewModel?.updateQuickProfileSelection();
    },
    shallowEqualArray
  );
  store.subscribeSelector(
    (current) => ({
      sequences: current.sequences,
      selectedSequenceId: current.selectedSequenceId,
      playback: current.playback,
      sequenceSync: current.sequenceSync,
      connection: current.connection
    }),
    () => {
      sequencesViewModel?.renderSequences();
    },
    shallowEqualObject
  );
  store.subscribeSelector(
    (current) => current.sessions,
    () => {
      sessionsViewModel?.renderSessions();
    },
    shallowEqualArray
  );

  loadData();
  themeView?.initTheme();
  themeView?.initContrast();
  sidebarView?.initSidebarCollapse();

  tabsView?.init();
  sidebarView?.initSidebarToggle();

  // Sidebar collapse toggle (desktop)
  elements.sidebarToggle?.addEventListener("click", () => sidebarView?.toggleSidebarCollapse());
  bindParamInputs({
    elements,
    state,
    onParamChange: (key, value) => paramsViewModel?.handleParamChange(key, value)
  });
  profilesView?.bindEvents();
  sequencesView?.bindEvents();
  sessionsView?.bindEvents();
  modalManager?.bindEvents();
  bindSettingsEvents({
    elements,
    state,
    onThemeChange: () => themeView?.applyTheme(),
    onContrastChange: () => themeView?.applyContrast()
  });

  // Theme toggle
  elements.themeToggle.addEventListener("click", () => themeView?.toggleTheme());

  connectionViewModel?.updateBluetoothOptionState();
  elements.connectionMode.addEventListener("change", (event) =>
    connectionViewModel?.handleConnectionModeChange(event)
  );

  elements.connectBtn.addEventListener("click", () => connectionViewModel?.handleConnectClick());
  elements.pingBtn.addEventListener("click", () => connectionViewModel?.handlePingClick());
  if (elements.latencyTestBtn) {
    elements.latencyTestBtn.addEventListener("click", () => bluetoothService.toggleLatencyTest());
  }

  elements.logToggleBtn.addEventListener("click", () => sessionsViewModel?.toggleLogging());
  elements.sidebarLogBtn.addEventListener("click", () => sessionsViewModel?.toggleLogging());
  elements.sessionsLogBtn.addEventListener("click", () => sessionsViewModel?.toggleLogging());

  elements.sendBtn.addEventListener("click", () => paramsViewModel?.handleSend());
  elements.stopBtn.addEventListener("click", () => paramsViewModel?.handleStop());

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
      visualizationViewModel?.updateChartControls();
    });
  }

  if (elements.windowRange) {
    elements.windowRange.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      state.visualization.windowSeconds = Number(target.value);
      const targetLength = getTargetBufferLength();
      while (state.visualization.buffer.length > targetLength) {
        state.visualization.buffer.shift();
      }
      visualizationViewModel?.updateChartControls();
      updateRangeFill(target);
    });
  }

  if (elements.gainRange) {
    elements.gainRange.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      state.visualization.gain = Number(target.value);
      visualizationViewModel?.updateChartControls();
      updateRangeFill(target);
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

  updateParamUI(state, elements);
  updateLastSentUI(state, elements);
  connectionViewModel?.updateView();
  store.notify();
  visualizationViewModel?.updateChartControls();
  document
    .querySelectorAll('input[type="range"]')
    .forEach((node) => updateRangeFill(node as HTMLInputElement));
  state.visualization.buffer = new Array(getTargetBufferLength()).fill(0);
  visualizationViewModel?.init();
}
