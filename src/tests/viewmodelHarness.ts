import { createInitialState } from "../state/initialState.js";
import { createStore } from "../state/store.js";
import { ProfilesViewModel } from "../viewmodels/profilesViewModel.js";
import { SessionsViewModel } from "../viewmodels/sessionsViewModel.js";
import { SequencesViewModel } from "../viewmodels/sequencesViewModel.js";
import type { ProfilesViewPort, SequencesViewPort, SessionsViewPort } from "../viewmodels/ports.js";
import type { BluetoothServicePort } from "../services/types.js";
import type { Elements } from "../ui/elements.js";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const noop = () => {};

const windowShim = globalThis as any;
windowShim.window = windowShim;
windowShim.alert = noop;
windowShim.prompt = () => "Updated";

const store = createStore(createInitialState());

let renderedProfiles: any[] = [];
let renderedSessions: any[] = [];
let renderedSequences: any = null;
let selectedProfileId: string | null = null;

const profilesView: ProfilesViewPort = {
  render: (profiles) => {
    renderedProfiles = profiles;
  },
  updateQuickProfileSelection: (profileId) => {
    selectedProfileId = profileId;
  },
  openCreateModal: noop,
  closeCreateModal: noop,
  resetForm: noop
};

const sessionsView: SessionsViewPort = {
  render: (sessions) => {
    renderedSessions = sessions;
  },
  showSessionModal: noop,
  closeSessionModal: noop
};

const sequencesView: SequencesViewPort = {
  render: (options) => {
    renderedSequences = options;
  }
};

const bluetoothService: BluetoothServicePort = {
  connect: async () => {},
  disconnect: async () => {},
  ping: async () => {},
  sendCommand: async () => {},
  isStreaming: () => false,
  toggleLatencyTest: noop,
  stopLatencyTest: noop,
  resetConnectionMetrics: noop,
  isAvailable: () => true
};

const elements = {
  loggingStatus: { textContent: "" },
  logToggleBtn: { textContent: "" },
  sidebarLogBtn: { innerHTML: "", title: "" },
  sessionsLogBtn: { innerHTML: "" }
} as Elements;

const profilesViewModel = new ProfilesViewModel({
  store,
  profilesView,
  persist: noop,
  updateParamUI: noop
});

const sequencesViewModel = new SequencesViewModel({
  store,
  sequencesView,
  persist: noop,
  updateParamUI: noop,
  bluetoothService
});

const sessionsViewModel = new SessionsViewModel({
  store,
  elements,
  sessionsView,
  persist: noop
});

const renderViews = () => {
  profilesViewModel.renderProfiles();
  profilesViewModel.updateQuickProfileSelection();
  sequencesViewModel.renderSequences();
  sessionsViewModel.renderSessions();
};

store.subscribe(renderViews);
renderViews();

profilesViewModel.handleSubmitCreate("Baseline");
assert(renderedProfiles.length === 1, "Profile should be created.");
assert(selectedProfileId === renderedProfiles[0].id, "Quick select should match first profile.");

store.update((state) => {
  state.sessions = [
    {
      id: "session-1",
      name: "Session 1",
      start: "2024-01-01 00:00:00",
      durationSec: 10,
      sampleCount: 2,
      samples: [0, 1],
      summary: { avg: 0, rms: 0, peak: 0, noise: 0 }
    }
  ];
});
sessionsViewModel.handleDelete("session-1");
assert(renderedSessions.length === 0, "Session should be deleted.");

sequencesViewModel.handleNewSequence();
assert(store.getState().sequences.length === 1, "Sequence should be created.");
assert(
  renderedSequences?.selectedSequenceId === store.getState().selectedSequenceId,
  "Sequence selection should be rendered."
);

console.log("Viewmodel harness passed.");
