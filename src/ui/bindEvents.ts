import type { AppState } from "../state/types.js";
import type { Elements } from "./elements.js";
import { updateParamUI, updateRangeFill } from "./paramUi.js";

export function bindParamInputs(options: {
  elements: Elements;
  state: AppState;
  onParamChange: (key: "freq" | "amp" | "noise", value: number) => void;
}) {
  const { elements, state, onParamChange } = options;
  elements.freqRange.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    onParamChange("freq", Number(target.value));
    updateRangeFill(target);
  });
  elements.freqNumber.addEventListener("input", (event) => {
    onParamChange("freq", Number((event.target as HTMLInputElement).value));
    updateRangeFill(elements.freqRange);
  });
  elements.ampRange.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    onParamChange("amp", Number(target.value));
    updateRangeFill(target);
  });
  elements.ampNumber.addEventListener("input", (event) => {
    onParamChange("amp", Number((event.target as HTMLInputElement).value));
    updateRangeFill(elements.ampRange);
  });
  elements.noiseRange.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    onParamChange("noise", Number(target.value));
    updateRangeFill(target);
  });
  elements.noiseNumber.addEventListener("input", (event) => {
    onParamChange("noise", Number((event.target as HTMLInputElement).value));
    updateRangeFill(elements.noiseRange);
  });
  elements.enableTremor.addEventListener("change", (event) => {
    state.params.enabled = (event.target as HTMLInputElement).checked;
    updateParamUI(state, elements);
  });
}

export function bindSettingsEvents(options: {
  elements: Elements;
  state: AppState;
  onThemeChange: () => void;
  onContrastChange: () => void;
}) {
  const { elements, state, onThemeChange, onContrastChange } = options;
  const darkModeToggle = elements.settingDarkMode;
  if (darkModeToggle) {
    darkModeToggle.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      state.theme = target.checked ? "dark" : "light";
      onThemeChange();
    });
  }
  if (elements.settingHighContrast) {
    elements.settingHighContrast.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      state.contrast = target.checked ? "high" : "normal";
      onContrastChange();
    });
  }
}
