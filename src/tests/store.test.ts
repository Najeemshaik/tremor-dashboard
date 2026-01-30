import { describe, it, expect, vi } from "vitest";
import { createStore } from "../state/store.js";

describe("store", () => {
  it("notifies subscribers on update", () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((state) => {
      state.count += 1;
    });

    expect(store.getState().count).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
