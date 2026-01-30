import type { Elements } from "../ui/elements.js";

export class ModalManager {
  private elements: Elements;
  private activeModal: HTMLElement | null = null;
  private lastFocusedElement: HTMLElement | null = null;

  constructor(elements: Elements) {
    this.elements = elements;
  }

  open(modal: HTMLElement) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    this.activeModal = modal;
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    if (this.elements.app) {
      this.elements.app.setAttribute("aria-hidden", "true");
    }
    const focusables = this.getFocusableElements(modal);
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  }

  close(modal: HTMLElement) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    this.activeModal = null;
    if (this.elements.app) {
      this.elements.app.removeAttribute("aria-hidden");
    }
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  bindEvents() {
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.close(this.elements.profileModal);
        this.close(this.elements.sessionModal);
      });
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.close(this.elements.profileModal);
        this.close(this.elements.sessionModal);
        return;
      }
      if (event.key !== "Tab" || !this.activeModal) return;
      const focusables = this.getFocusableElements(this.activeModal);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  private getFocusableElements(container: HTMLElement) {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    return (Array.from(container.querySelectorAll(selector)) as HTMLElement[]).filter(
      (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
    );
  }
}
