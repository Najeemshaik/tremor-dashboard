import { CONTRAST_KEY, THEME_KEY } from "../core/constants.js";
import type { AppState } from "../state/types.js";
import type { Elements } from "../ui/elements.js";

export class ThemeView {
  private state: AppState;
  private elements: Elements;
  private themeTransitionTimer: number | null = null;
  private themeFadeTimer: number | null = null;

  constructor(options: { state: AppState; elements: Elements }) {
    this.state = options.state;
    this.elements = options.elements;
  }

  initTheme() {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (savedTheme === "light" || savedTheme === "dark") {
      this.state.theme = savedTheme;
    } else if (prefersDark) {
      this.state.theme = "dark";
    }

    this.applyTheme();
  }

  initContrast() {
    const savedContrast = window.localStorage.getItem(CONTRAST_KEY);
    if (savedContrast === "high") {
      this.state.contrast = "high";
    }
    this.applyContrast();
  }

  applyTheme() {
    if (this.themeTransitionTimer) {
      clearTimeout(this.themeTransitionTimer);
    }
    document.documentElement.classList.add("theme-transition");
    const fade = document.querySelector(".theme-fade");
    if (fade) {
      fade.classList.add("active");
      if (this.themeFadeTimer) {
        clearTimeout(this.themeFadeTimer);
      }
      this.themeFadeTimer = window.setTimeout(() => {
        fade.classList.remove("active");
      }, 220);
    }
    document.documentElement.setAttribute("data-theme", this.state.theme);

    const lightIcon = this.elements.themeIconLight;
    const darkIcon = this.elements.themeIconDark;
    const darkModeToggle = this.elements.settingDarkMode;

    if (lightIcon && darkIcon) {
      if (this.state.theme === "dark") {
        lightIcon.style.display = "none";
        darkIcon.style.display = "block";
      } else {
        lightIcon.style.display = "block";
        darkIcon.style.display = "none";
      }
    }

    if (darkModeToggle) {
      darkModeToggle.checked = this.state.theme === "dark";
    }

    window.localStorage.setItem(THEME_KEY, this.state.theme);
    this.themeTransitionTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 560);
  }

  applyContrast() {
    if (this.state.contrast === "high") {
      document.documentElement.setAttribute("data-contrast", "high");
    } else {
      document.documentElement.removeAttribute("data-contrast");
    }

    if (this.elements.settingHighContrast) {
      this.elements.settingHighContrast.checked = this.state.contrast === "high";
    }

    window.localStorage.setItem(CONTRAST_KEY, this.state.contrast);
  }

  toggleTheme() {
    this.state.theme = this.state.theme === "light" ? "dark" : "light";
    this.applyTheme();
  }
}
