import { SIDEBAR_COLLAPSED_KEY } from "../core/constants.js";
import type { AppState } from "../state/types.js";
import type { Elements } from "../ui/elements.js";

export class SidebarView {
  private state: AppState;
  private elements: Elements;

  constructor(options: { state: AppState; elements: Elements }) {
    this.state = options.state;
    this.elements = options.elements;
  }

  initSidebarCollapse() {
    const savedState = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (savedState === "true") {
      this.state.sidebarCollapsed = true;
    }
    this.applySidebarCollapse();
  }

  initSidebarToggle() {
    const toggle = () => {
      const isOpen = this.elements.sidebar.classList.contains("open");
      this.setSidebarOpen(!isOpen);
    };
    this.elements.mobileNavToggle.addEventListener("click", toggle);
    this.elements.sidebarOverlay.addEventListener("click", () => this.setSidebarOpen(false));
  }

  toggleSidebarCollapse() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    this.applySidebarCollapse();
  }

  setSidebarOpen(open: boolean) {
    if (open) {
      this.elements.sidebar.classList.add("open");
      this.elements.sidebarOverlay.classList.add("visible");
      this.elements.sidebarOverlay.setAttribute("aria-hidden", "false");
    } else {
      this.elements.sidebar.classList.remove("open");
      this.elements.sidebarOverlay.classList.remove("visible");
      this.elements.sidebarOverlay.setAttribute("aria-hidden", "true");
    }
    if (this.elements.mobileNavToggle) {
      this.elements.mobileNavToggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  applySidebarCollapse() {
    const main = document.querySelector(".main") as HTMLElement | null;
    const isMobile = window.innerWidth <= 900;

    if (isMobile) {
      this.elements.sidebar.classList.remove("collapsed");
      if (main) {
        main.style.marginLeft = "0";
      }
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.state.sidebarCollapsed));
      return;
    }

    if (this.state.sidebarCollapsed) {
      this.elements.sidebar.classList.add("collapsed");
      if (main && window.innerWidth > 900) {
        main.style.marginLeft = "var(--sidebar-collapsed)";
      }
    } else {
      this.elements.sidebar.classList.remove("collapsed");
      if (main && window.innerWidth > 900) {
        main.style.marginLeft = "var(--sidebar-width)";
      }
    }
    if (this.elements.sidebarToggle) {
      this.elements.sidebarToggle.setAttribute(
        "aria-pressed",
        this.state.sidebarCollapsed ? "true" : "false"
      );
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.state.sidebarCollapsed));
  }
}
