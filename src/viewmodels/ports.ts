import type { AppState, Session } from "../state/types.js";

export type ConnectionViewPort = {
  update: () => void;
  updateBluetoothOptionState: () => void;
  setLatencyWarning: (message: string, level: "hidden" | "warning" | "alert") => void;
};

export type ProfilesViewPort = {
  render: (profiles: AppState["profiles"]) => void;
  updateQuickProfileSelection: (profileId: string | null) => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  resetForm: () => void;
};

export type SessionsViewPort = {
  render: (sessions: Session[]) => void;
  showSessionModal: (session: Session, avgFreq: string) => void;
  closeSessionModal: () => void;
};

export type SequencesViewPort = {
  render: (options: {
    sequences: AppState["sequences"];
    selectedSequenceId: string | null;
    playback: AppState["playback"];
    sequenceSync: AppState["sequenceSync"];
    connection: AppState["connection"];
  }) => void;
};

export type VisualizationViewPort = {
  setup: () => void;
  updateChartControls: () => void;
};
