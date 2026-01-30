import type { AppState } from "../state/types.js";
import type { Elements } from "./elements.js";

export function updateRangeFill(input: HTMLInputElement | null) {
  if (!input) return;
  const min = Number.parseFloat(input.min ?? "0");
  const max = Number.parseFloat(input.max ?? "100");
  const value = Number.parseFloat(input.value ?? "0");
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--range-fill", `${percent}%`);
}

export function updateParamUI(state: AppState, elements: Elements) {
  elements.freqRange.value = String(state.params.freq);
  elements.freqNumber.value = state.params.freq.toFixed(0);
  elements.ampRange.value = String(state.params.amp);
  elements.ampNumber.value = String(state.params.amp);
  elements.noiseRange.value = String(state.params.noise);
  elements.noiseNumber.value = String(state.params.noise);
  elements.enableTremor.checked = state.params.enabled;

  updateRangeFill(elements.freqRange);
  updateRangeFill(elements.ampRange);
  updateRangeFill(elements.noiseRange);

  const dirty = isDirty(state);
  elements.unsavedIndicator.style.display = dirty ? "inline-flex" : "none";
}

export function updateLastSentUI(state: AppState, elements: Elements) {
  if (!state.lastSentAt) {
    elements.lastSent.textContent = "--";
    return;
  }
  elements.lastSent.textContent = state.lastSentAt;
}

export function isDirty(state: AppState) {
  return (
    state.params.freq !== state.lastSent.freq ||
    state.params.amp !== state.lastSent.amp ||
    state.params.noise !== state.lastSent.noise ||
    state.params.enabled !== state.lastSent.enabled
  );
}
