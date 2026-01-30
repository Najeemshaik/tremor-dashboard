import { describe, it, expect, vi } from "vitest";
import { createInitialState } from "../state/initialState.js";
import { createStore } from "../state/store.js";
import { ProfilesViewModel } from "../viewmodels/profilesViewModel.js";
import type { ProfilesViewPort } from "../viewmodels/ports.js";

describe("ProfilesViewModel", () => {
  it("creates a profile and updates quick selection", () => {
    const store = createStore(createInitialState());
    const renderSpy = vi.fn();
    const quickSelectSpy = vi.fn();

    const view: ProfilesViewPort = {
      render: renderSpy,
      updateQuickProfileSelection: quickSelectSpy,
      openCreateModal: vi.fn(),
      closeCreateModal: vi.fn(),
      resetForm: vi.fn()
    };

    const viewModel = new ProfilesViewModel({
      store,
      profilesView: view,
      persist: vi.fn(),
      updateParamUI: vi.fn()
    });

    viewModel.handleSubmitCreate("Baseline");

    const state = store.getState();
    expect(state.profiles.length).toBe(1);
    expect(state.profiles[0].name).toBe("Baseline");
    expect(quickSelectSpy).toHaveBeenCalledWith(state.profiles[0].id);
  });
});
