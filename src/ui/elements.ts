export type Elements = {
  app: HTMLElement | null;
  tabs: HTMLElement[];
  panels: HTMLElement[];
  pageTitle: HTMLElement;
  sidebar: HTMLElement;
  sidebarToggle: HTMLButtonElement | null;
  mobileNavToggle: HTMLButtonElement | null;
  sidebarOverlay: HTMLElement;
  sidebarStatusText: HTMLElement;
  sidebarStatusDot: HTMLElement;
  topStatusPill: HTMLElement;
  topLatency: HTMLElement;
  topPer: HTMLElement;
  themeToggle: HTMLButtonElement;
  themeIconLight: HTMLElement | null;
  themeIconDark: HTMLElement | null;

  connectionMode: HTMLSelectElement;
  connectBtn: HTMLButtonElement;
  pingBtn: HTMLButtonElement;
  latencyTestBtn: HTMLButtonElement | null;
  latencyWarning: HTMLElement | null;
  connectionStatusPill: HTMLElement;
  latencyValue: HTMLElement;
  perValue: HTMLElement;
  healthMode: HTMLElement | null;

  logToggleBtn: HTMLButtonElement;
  sidebarLogBtn: HTMLButtonElement;
  sessionsLogBtn: HTMLButtonElement;
  loggingStatus: HTMLElement;

  freqRange: HTMLInputElement;
  freqNumber: HTMLInputElement;
  ampRange: HTMLInputElement;
  ampNumber: HTMLInputElement;
  noiseRange: HTMLInputElement;
  noiseNumber: HTMLInputElement;
  enableTremor: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
  lastSent: HTMLElement;
  unsavedIndicator: HTMLElement;

  freezeBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  tremorCanvas: HTMLCanvasElement;
  chartContainer: HTMLElement | null;
  chartTooltip: HTMLElement | null;
  chartLive: HTMLElement | null;
  spectrumCanvas: HTMLCanvasElement;
  sampleRateValue: HTMLElement | null;
  spectrumFreezeBtn: HTMLButtonElement | null;
  windowRange: HTMLInputElement | null;
  windowValue: HTMLElement | null;
  gainRange: HTMLInputElement | null;
  gainValue: HTMLElement | null;
  snapshotBtn: HTMLButtonElement | null;

  metricFrequency: HTMLElement;
  metricRMS: HTMLElement;
  metricPower: HTMLElement;
  metricRegularity: HTMLElement;
  metricUPDRS: HTMLElement;
  metricSNR: HTMLElement;
  metricPeakToPeak: HTMLElement;
  metricBandwidth: HTMLElement;
  metricStability: HTMLElement;
  metricHarmonic: HTMLElement;

  freqIndicator: HTMLElement;
  rmsIndicator: HTMLElement;
  powerIndicator: HTMLElement;
  regularityIndicator: HTMLElement;
  updrsIndicator: HTMLElement;
  snrIndicator: HTMLElement;
  peakToPeakIndicator: HTMLElement;
  bandwidthIndicator: HTMLElement;
  stabilityIndicator: HTMLElement;
  harmonicIndicator: HTMLElement;

  profileSelect: HTMLSelectElement;
  loadProfileBtn: HTMLButtonElement;
  saveProfileBtn: HTMLButtonElement;
  profilesTable: HTMLElement;
  profilesEmpty: HTMLElement;
  profileModal: HTMLElement;
  profileForm: HTMLFormElement;
  profileName: HTMLInputElement;

  sequenceList: HTMLElement;
  sequenceEditor: HTMLElement;
  sequencesEmpty: HTMLElement;
  newSequenceBtn: HTMLButtonElement;

  sessionsTable: HTMLElement;
  sessionsEmpty: HTMLElement;
  sessionModal: HTMLElement;
  sessionSummary: HTMLElement;
  sessionCanvas: HTMLCanvasElement;
  deleteSessionBtn: HTMLButtonElement;
  exportCsvBtn: HTMLButtonElement;
  exportJsonBtn: HTMLButtonElement;

  settingDarkMode: HTMLInputElement | null;
  settingHighContrast: HTMLInputElement | null;
};
