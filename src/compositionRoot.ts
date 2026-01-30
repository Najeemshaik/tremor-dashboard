import { createInitialState } from "./state/initialState.js";
import { createStore } from "./state/store.js";
import { BLE_CONFIG } from "./services/bluetooth/bleConfig.js";
import { BluetoothService } from "./services/bluetooth/bluetoothService.js";
import { MockConnectionService } from "./services/mock/mockConnectionService.js";
import { MockTelemetryService } from "./services/mock/mockTelemetryService.js";
import { persistStoredData } from "./services/storage/storageService.js";
import { ConnectionView } from "./views/connectionView.js";
import { ModalManager } from "./views/modalManager.js";
import { TabsView } from "./views/tabsView.js";
import { ThemeView } from "./views/themeView.js";
import { SidebarView } from "./views/sidebarView.js";
import { VisualizationView } from "./views/visualizationView.js";
import { ProfilesView } from "./views/profilesView.js";
import { SequencesView } from "./views/sequencesView.js";
import { SessionsView } from "./views/sessionsView.js";
import { ConnectionViewModel } from "./viewmodels/connectionViewModel.js";
import { ParamsViewModel } from "./viewmodels/paramsViewModel.js";
import { VisualizationViewModel } from "./viewmodels/visualizationViewModel.js";
import { SessionsViewModel } from "./viewmodels/sessionsViewModel.js";
import { ProfilesViewModel } from "./viewmodels/profilesViewModel.js";
import { SequencesViewModel } from "./viewmodels/sequencesViewModel.js";
import { bindElements } from "./ui/bindElements.js";
import { updateLastSentUI, updateParamUI } from "./ui/paramUi.js";
import type { AppDependencies } from "./app.js";

export function createAppDependencies(): AppDependencies {
  const store = createStore(createInitialState());
  const state = store.getState();
  const elements = bindElements();

  let connectionView: ConnectionView;
  let visualizationView: VisualizationView;
  let visualizationViewModel: VisualizationViewModel;
  let profilesViewModel: ProfilesViewModel;
  let sequencesViewModel: SequencesViewModel;
  let sessionsViewModel: SessionsViewModel;

  const bluetoothService = new BluetoothService({
    state,
    bleConfig: BLE_CONFIG,
    onUpdateUI: () => connectionView?.update(),
    onLatencyWarning: (message, level) => connectionView?.setLatencyWarning(message, level),
    onSample: (sample) => visualizationView?.updateSignal(0, sample)
  });

  const mockConnection = new MockConnectionService({
    onStatus: (status) => {
      state.connection.status = status;
      if (status === "disconnected") {
        bluetoothService.resetConnectionMetrics();
      }
      connectionView?.update();
    },
    onMetrics: ({ latency, per }) => {
      state.connection.latency = latency;
      state.connection.per = per;
      connectionView?.update();
    }
  });

  const mockTelemetry = new MockTelemetryService();

  connectionView = new ConnectionView({ elements, state, bluetoothService });
  const modalManager = new ModalManager(elements);
  const themeView = new ThemeView({ state, elements });
  const sidebarView = new SidebarView({ state, elements });

  const profilesView = new ProfilesView({
    elements,
    modalManager,
    onOpenCreate: () => profilesViewModel.handleOpenCreate(),
    onSubmitCreate: (name) => profilesViewModel.handleSubmitCreate(name),
    onQuickLoad: (id) => profilesViewModel.handleQuickLoad(id),
    onAction: (action, id) => profilesViewModel.handleAction(action, id)
  });

  const sequencesView = new SequencesView({
    elements,
    onNewSequence: () => sequencesViewModel.handleNewSequence(),
    onListAction: (action, id) => sequencesViewModel.handleListAction(action, id),
    onEditorInput: (payload) => sequencesViewModel.handleEditorInput(payload),
    onEditorAction: (payload) => sequencesViewModel.handleEditorAction(payload)
  });

  const sessionsView = new SessionsView({
    elements,
    modalManager,
    onView: (id) => sessionsViewModel.handleView(id),
    onDelete: (id) => sessionsViewModel.handleDelete(id),
    onDeleteConfirm: (id) => sessionsViewModel.handleDeleteConfirm(id),
    onExportCsv: (id) => sessionsViewModel.handleExportCsv(id),
    onExportJson: (id) => sessionsViewModel.handleExportJson(id)
  });

  visualizationView = new VisualizationView({
    elements,
    state,
    getSample: (delta) =>
      visualizationViewModel?.getSample(delta) ??
      (bluetoothService.isStreaming() ? null : mockTelemetry.nextSample({ delta, params: state.params }))
  });

  const connectionViewModel = new ConnectionViewModel({
    store,
    bluetoothService,
    mockConnection,
    connectionView
  });

  const persist = () => {
    persistStoredData({
      profiles: state.profiles,
      sequences: state.sequences,
      sessions: state.sessions
    });
  };

  const updateParamUIFn = () => updateParamUI(state, elements);
  const updateLastSentUIFn = () => updateLastSentUI(state, elements);

  const paramsViewModel = new ParamsViewModel({
    store,
    bluetoothService,
    updateParamUI: updateParamUIFn,
    updateLastSentUI: updateLastSentUIFn
  });

  visualizationViewModel = new VisualizationViewModel({
    store,
    mockTelemetry,
    bluetoothService,
    visualizationView
  });

  sessionsViewModel = new SessionsViewModel({
    store,
    elements,
    sessionsView,
    persist
  });

  profilesViewModel = new ProfilesViewModel({
    store,
    profilesView,
    persist,
    updateParamUI: updateParamUIFn
  });

  sequencesViewModel = new SequencesViewModel({
    store,
    sequencesView,
    persist,
    updateParamUI: updateParamUIFn,
    bluetoothService
  });

  const tabsView = new TabsView({ elements, onTabChange: () => sidebarView.setSidebarOpen(false) });

  return {
    store,
    elements,
    bluetoothService,
    mockConnection,
    mockTelemetry,
    connectionView,
    modalManager,
    tabsView,
    themeView,
    sidebarView,
    visualizationView,
    profilesView,
    sequencesView,
    sessionsView,
    connectionViewModel,
    paramsViewModel,
    visualizationViewModel,
    sessionsViewModel,
    profilesViewModel,
    sequencesViewModel
  };
}
