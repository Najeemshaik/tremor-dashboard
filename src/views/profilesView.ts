import { formatDate, formatNumber } from "../core/format.js";
import type { Profile } from "../state/types.js";
import type { Elements } from "../ui/elements.js";
import type { ModalManager } from "./modalManager.js";

export class ProfilesView {
  private elements: Elements;
  private modalManager: ModalManager;
  private onOpenCreate: () => void;
  private onSubmitCreate: (name: string) => void;
  private onQuickLoad: (id: string) => void;
  private onAction: (action: string, id: string) => void;

  constructor(options: {
    elements: Elements;
    modalManager: ModalManager;
    onOpenCreate: () => void;
    onSubmitCreate: (name: string) => void;
    onQuickLoad: (id: string) => void;
    onAction: (action: string, id: string) => void;
  }) {
    this.elements = options.elements;
    this.modalManager = options.modalManager;
    this.onOpenCreate = options.onOpenCreate;
    this.onSubmitCreate = options.onSubmitCreate;
    this.onQuickLoad = options.onQuickLoad;
    this.onAction = options.onAction;
  }

  render(profiles: Profile[]) {
    this.elements.profileSelect.innerHTML = "";
    if (profiles.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No profiles available";
      option.disabled = true;
      option.selected = true;
      this.elements.profileSelect.appendChild(option);
    } else {
      profiles.forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        this.elements.profileSelect.appendChild(option);
      });
    }

    this.elements.profilesTable.innerHTML = "";
    if (profiles.length === 0) {
      this.elements.profilesEmpty.classList.remove("hidden");
      return;
    }
    this.elements.profilesEmpty.classList.add("hidden");

    profiles.forEach((profile: Profile) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <th scope="row"><strong>${profile.name}</strong></th>
        <td>${formatDate(profile.updated)}</td>
        <td><span style="font-family: var(--font-mono)">${formatNumber(profile.freq, 0)}</span> Hz</td>
        <td><span style="font-family: var(--font-mono)">${Math.round(profile.amp)}</span></td>
        <td><span style="font-family: var(--font-mono)">${Math.round(profile.noise)}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary" data-action="load" data-id="${profile.id}" aria-label="Load profile ${profile.name}">Load</button>
            <button class="btn btn-ghost" data-action="rename" data-id="${profile.id}" aria-label="Rename profile ${profile.name}">Rename</button>
            <button class="btn btn-ghost" data-action="duplicate" data-id="${profile.id}" aria-label="Copy profile ${profile.name}">Copy</button>
            <button class="btn btn-danger" data-action="delete" data-id="${profile.id}" aria-label="Delete profile ${profile.name}">Delete</button>
          </div>
        </td>
      `;
      this.elements.profilesTable.appendChild(row);
    });
  }

  updateQuickProfileSelection(profileId: string | null) {
    if (profileId) {
      this.elements.profileSelect.value = profileId;
    }
  }

  bindEvents() {
    this.elements.saveProfileBtn.addEventListener("click", () => {
      this.elements.profileName.value = "";
      this.onOpenCreate();
    });

    this.elements.profileForm.addEventListener("submit", (event: Event) => {
      event.preventDefault();
      const name = this.elements.profileName.value.trim();
      if (!name) return;
      this.onSubmitCreate(name);
    });

    this.elements.loadProfileBtn.addEventListener("click", () => {
      const selected = this.elements.profileSelect.value;
      if (selected) this.onQuickLoad(selected);
    });

    this.elements.profilesTable.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;
      this.onAction(action, id);
    });
  }

  openCreateModal() {
    this.modalManager.open(this.elements.profileModal);
    this.elements.profileName.focus();
  }

  closeCreateModal() {
    this.modalManager.close(this.elements.profileModal);
  }

  resetForm() {
    this.elements.profileForm.reset();
  }
}
