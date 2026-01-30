import type { Elements } from "../ui/elements.js";

export class TabsView {
  private elements: Elements;
  private onTabChange: () => void;

  constructor(options: { elements: Elements; onTabChange: () => void }) {
    this.elements = options.elements;
    this.onTabChange = options.onTabChange;
  }

  init() {
    this.elements.tabs.forEach((tab: HTMLElement, index: number) => {
      tab.addEventListener("click", () => {
        this.setActiveTab(tab.dataset.tab, { focus: false });
        this.onTabChange();
      });

      tab.addEventListener("keydown", (event: KeyboardEvent) => {
        const key = event.key;
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
        event.preventDefault();
        const lastIndex = this.elements.tabs.length - 1;
        let nextIndex = index;
        if (key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
        if (key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
        if (key === "Home") nextIndex = 0;
        if (key === "End") nextIndex = lastIndex;
        const nextTab = this.elements.tabs[nextIndex];
        if (nextTab) {
          this.setActiveTab(nextTab.dataset.tab, { focus: true });
        }
      });
    });

    const initialTab = this.elements.tabs.find((tab: HTMLElement) => tab.classList.contains("active"));
    if (initialTab) {
      this.setActiveTab(initialTab.dataset.tab, { focus: false });
    }
  }

  private setActiveTab(tabId: string, { focus = false }: { focus?: boolean } = {}) {
    this.elements.tabs.forEach((btn: HTMLElement) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.tabIndex = isActive ? 0 : -1;
      if (isActive && focus) {
        btn.focus();
      }
    });

    this.elements.panels.forEach((panel: HTMLElement) => {
      if (panel.id === `tab-${tabId}`) {
        panel.classList.remove("hidden");
        panel.classList.add("active");
      } else {
        panel.classList.add("hidden");
        panel.classList.remove("active");
      }
    });

    const activeTab = this.elements.tabs.find((btn: HTMLElement) => btn.dataset.tab === tabId);
    if (activeTab) {
      this.elements.pageTitle.textContent = activeTab.textContent.trim();
    }
  }
}
