/* global window, document */

import { seedProfiles, seedSequences, seedSessions } from "./state/seedData.js";
import {
  clearSupabaseStorageConfig,
  clearSupabaseConfigFile,
  getSupabaseStorageStatus,
  loadStoredData,
  loadSupabaseConfigFromFilePicker,
  persistStoredData,
  saveSupabaseStorageConfig,
  tryLoadSupabaseConfigFromStoredFile,
  type StoredPayload
} from "./services/storage/storageService.js";
import { SqliteStorageService } from "./services/database/sqliteStorageService.js";
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
let sqliteStorage: SqliteStorageService | null = null;

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
  sqliteStorage: SqliteStorageService | null;
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
  sqliteStorage = deps.sqliteStorage ?? null;
}

// Data persistence
function getPersistableData(): StoredPayload {
  return {
    profiles: state.profiles,
    sequences: state.sequences,
    sessions: state.sessions
  };
}

function applyStoredData(parsed: StoredPayload | null) {
  if (parsed) {
    store.update((state) => {
      state.profiles = parsed.profiles || seedProfiles;
      state.sequences = parsed.sequences || seedSequences;
      state.sessions = parsed.sessions || seedSessions;
    });
    return;
  }
  store.update((state) => {
    state.profiles = seedProfiles;
    state.sequences = seedSequences;
    state.sessions = seedSessions;
  });
}

async function loadData() {
  try {
    const parsed = await loadStoredData();
    applyStoredData(parsed);
  } catch (error) {
    console.error("Failed to load stored data:", error);
    applyStoredData(null);
  }
}

async function refreshSupabaseStatusUI() {
  const statusEl = elements.supabaseStatus;
  if (!statusEl) return;

  const status = await getSupabaseStorageStatus();
  if (!status.configured) {
    statusEl.textContent = "Supabase is not configured. Load a config file to connect.";
    if (elements.supabaseClearConfigBtn) elements.supabaseClearConfigBtn.disabled = true;
    return;
  }

  statusEl.textContent = status.message;
  if (elements.supabaseClearConfigBtn) elements.supabaseClearConfigBtn.disabled = false;
}

async function handleSupabaseLoadConfig() {
  try {
    const config = await loadSupabaseConfigFromFilePicker();
    saveSupabaseStorageConfig(config);
    const loaded = await loadStoredData();
    if (loaded) {
      applyStoredData(loaded);
    } else {
      await persistStoredData(getPersistableData());
    }
    await refreshSupabaseStatusUI();
    store.notify();
  } catch (error) {
    window.alert((error as Error).message || "Unable to load Supabase config file.");
  }
}

async function handleSupabaseClear() {
  clearSupabaseStorageConfig();
  await clearSupabaseConfigFile();
  await refreshSupabaseStatusUI();
}

function getTargetBufferLength() {
  const length = Math.round(state.visualization.sampleRate * state.visualization.windowSeconds);
  return Math.max(60, length);
}

// Initialize
export async function initApp() {
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

  // Bootstrap Supabase config before loading data
  const storedConfig = await tryLoadSupabaseConfigFromStoredFile();
  if (storedConfig) {
    saveSupabaseStorageConfig(storedConfig);
    document.getElementById("configOverlay")?.classList.add("hidden");
    await loadData();
  } else {
    // No stored config — show blocking overlay and wait for user to select a file
    await new Promise<void>((resolve) => {
      const overlay = document.getElementById("configOverlay");
      const btn = document.getElementById("configOverlayBtn") as HTMLButtonElement | null;
      const errorEl = document.getElementById("configOverlayError");

      btn?.addEventListener("click", () => {
        void (async () => {
          if (btn) btn.disabled = true;
          if (errorEl) errorEl.textContent = "";
          try {
            const config = await loadSupabaseConfigFromFilePicker();
            saveSupabaseStorageConfig(config);
            if (overlay) overlay.classList.add("hidden");
            await loadData();
            resolve();
          } catch (err) {
            if (errorEl) errorEl.textContent = (err as Error).message || "Could not load config file. Please try again.";
          } finally {
            if (btn) btn.disabled = false;
          }
        })();
      });
    });
  }
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
  if (elements.supabaseLoadConfigBtn) {
    elements.supabaseLoadConfigBtn.addEventListener("click", () => {
      void handleSupabaseLoadConfig();
    });
  }
  if (elements.supabaseClearConfigBtn) {
    elements.supabaseClearConfigBtn.addEventListener("click", () => {
      void handleSupabaseClear();
    });
  }

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
    store.update((state) => {
      state.visualization.freeze = !state.visualization.freeze;
    });
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
    store.update((state) => {
      state.visualization.buffer = new Array(getTargetBufferLength()).fill(0);
    });
  });

  if (elements.snapshotBtn) {
    elements.snapshotBtn.addEventListener("click", () => {
      store.update((state) => {
        if (state.visualization.snapshot) {
          state.visualization.snapshot = null;
        } else {
          state.visualization.snapshot = state.visualization.buffer.slice();
        }
      });
      visualizationViewModel?.updateChartControls();
    });
  }

  if (elements.windowRange) {
    elements.windowRange.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      store.update((state) => {
        state.visualization.windowSeconds = Number(target.value);
        const targetLength = getTargetBufferLength();
        state.visualization.buffer = state.visualization.buffer.slice(-targetLength);
      });
      visualizationViewModel?.updateChartControls();
      updateRangeFill(target);
    });
  }

  if (elements.gainRange) {
    elements.gainRange.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      store.update((state) => {
        state.visualization.gain = Number(target.value);
      });
      visualizationViewModel?.updateChartControls();
      updateRangeFill(target);
    });
  }

  if (elements.spectrumFreezeBtn) {
    elements.spectrumFreezeBtn.addEventListener("click", () => {
      store.update((state) => {
        state.visualization.freezeSpectrum = !state.visualization.freezeSpectrum;
      });
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
  void refreshSupabaseStatusUI();
}
