import { createId } from "../core/id.js";
import { nowTimestamp } from "../core/format.js";
import type { AppState, Profile } from "../state/types.js";
import type { Store } from "../state/store.js";
import { exportProfilesJSON } from "../services/export/exportService.js";
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
    this.profilesView.render(this.state.profiles, this.getActiveProfileId());
  }

  updateQuickProfileSelection() {
    const firstId = this.state.profiles.length > 0 ? this.state.profiles[0].id : null;
    this.profilesView.updateQuickProfileSelection(firstId);
  }

  handleOpenCreate() {
    this.profilesView.openCreateModal();
  }

  handleSubmitCreate(name: string) {
    const now = nowTimestamp();
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
        profile.updated = nowTimestamp();
      }
    }
    if (action === "duplicate") {
      const copy: Profile = {
        ...profile,
        id: createId("profile"),
        name: `${profile.name} (Copy)`,
        updated: nowTimestamp()
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

  handleExport() {
    const profiles = this.state.profiles.map((profile) => ({
      name: profile.name,
      updated: profile.updated,
      freq: profile.freq,
      amp: profile.amp,
      noise: profile.noise
    }));
    exportProfilesJSON(profiles);
  }

  async handleImport(file: File) {
    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const incoming = Array.isArray(parsed)
        ? parsed
        : (parsed as { profiles?: unknown }).profiles;

      if (!Array.isArray(incoming)) {
        window.alert("Invalid profile file. Expected a profiles array.");
        return;
      }

      const now = nowTimestamp();
      const imported = incoming
        .map((item) => this.normalizeProfile(item, now))
        .filter((profile): profile is Profile => profile !== null);

      if (imported.length === 0) {
        window.alert("No valid profiles found to import.");
        return;
      }

      this.store.update((state) => {
        state.profiles = [...imported, ...state.profiles];
      });
      this.persist();
      this.updateQuickProfileSelection();
    } catch (error) {
      window.alert("Unable to import profiles. Please check the file format.");
    }
  }

  private findProfile(id: string) {
    return this.state.profiles.find((item) => item.id === id);
  }

  private getActiveProfileId() {
    const params = this.state.params;
    const match = this.state.profiles.find(
      (profile) =>
        profile.freq === params.freq &&
        profile.amp === params.amp &&
        profile.noise === params.noise
    );
    return match?.id ?? null;
  }

  private normalizeProfile(item: unknown, fallbackUpdated: string): Profile | null {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Partial<Profile>;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const freq = Number(candidate.freq);
    const amp = Number(candidate.amp);
    const noise = Number(candidate.noise);

    if (!name || !Number.isFinite(freq) || !Number.isFinite(amp) || !Number.isFinite(noise)) {
      return null;
    }

    return {
      id: createId("profile"),
      name,
      updated: typeof candidate.updated === "string" ? candidate.updated : fallbackUpdated,
      freq,
      amp,
      noise
    };
  }
}
