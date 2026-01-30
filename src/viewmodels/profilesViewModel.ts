import { createId } from "../core/id.js";
import type { AppState, Profile } from "../state/types.js";
import type { Store } from "../state/store.js";
import type { ProfilesViewPort } from "./ports.js";

export class ProfilesViewModel {
  private store: Store<AppState>;
  private profilesView: ProfilesViewPort;
  private persist: () => void;
  private updateParamUI: () => void;

  constructor(options: {
    store: Store<AppState>;
    profilesView: ProfilesViewPort;
    persist: () => void;
    updateParamUI: () => void;
  }) {
    this.store = options.store;
    this.profilesView = options.profilesView;
    this.persist = options.persist;
    this.updateParamUI = options.updateParamUI;
  }

  private get state() {
    return this.store.getState();
  }

  renderProfiles() {
    this.profilesView.render(this.state.profiles);
  }

  updateQuickProfileSelection() {
    const firstId = this.state.profiles.length > 0 ? this.state.profiles[0].id : null;
    this.profilesView.updateQuickProfileSelection(firstId);
  }

  handleOpenCreate() {
    this.profilesView.openCreateModal();
  }

  handleSubmitCreate(name: string) {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const profile: Profile = {
      id: createId("profile"),
      name,
      updated: now,
      freq: this.state.params.freq,
      amp: this.state.params.amp,
      noise: this.state.params.noise
    };
    this.store.update((state) => {
      state.profiles.unshift(profile);
    });
    this.persist();
    this.updateQuickProfileSelection();
    this.profilesView.closeCreateModal();
    this.profilesView.resetForm();
  }

  handleQuickLoad(id: string) {
    const profile = this.findProfile(id);
    if (!profile) return;
    this.store.update((state) => {
      state.params.freq = profile.freq;
      state.params.amp = profile.amp;
      state.params.noise = profile.noise;
    });
    this.updateParamUI();
  }

  handleAction(action: string, id: string) {
    const profile = this.findProfile(id);
    if (!profile) return;

    if (action === "load") {
      this.handleQuickLoad(id);
    }
    if (action === "rename") {
      const newName = window.prompt("Enter new profile name:", profile.name);
      if (newName && newName.trim()) {
        profile.name = newName.trim();
        profile.updated = new Date().toISOString().slice(0, 19).replace("T", " ");
      }
    }
    if (action === "duplicate") {
      const copy: Profile = {
        ...profile,
        id: createId("profile"),
        name: `${profile.name} (Copy)`,
        updated: new Date().toISOString().slice(0, 19).replace("T", " ")
      };
      this.store.update((state) => {
        state.profiles.unshift(copy);
      });
    }
    if (action === "delete") {
      this.store.update((state) => {
        state.profiles = state.profiles.filter((item) => item.id !== id);
      });
    }

    this.persist();
  }

  private findProfile(id: string) {
    return this.state.profiles.find((item) => item.id === id);
  }
}
