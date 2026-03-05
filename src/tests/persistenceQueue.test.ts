import { describe, expect, it, vi } from "vitest";
import { createPersistenceQueue } from "../services/storage/persistenceQueue.js";

describe("createPersistenceQueue", () => {
  it("coalesces rapid writes into a single persist", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async () => {});
    const queue = createPersistenceQueue({ persist, debounceMs: 200 });

    queue.schedule({ profiles: [{ id: "a" }] } as any);
    queue.schedule({ profiles: [{ id: "b" }] } as any);
    queue.schedule({ profiles: [{ id: "c" }] } as any);

    await vi.advanceTimersByTimeAsync(210);
    await queue.flush();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toMatchObject({ profiles: [{ id: "c" }] });
    vi.useRealTimers();
  });

  it("flush persists immediately when data is queued", async () => {
    const persist = vi.fn(async () => {});
    const queue = createPersistenceQueue({ persist, debounceMs: 1000 });

    queue.schedule({ sessions: [{ id: "s1" }] } as any);
    await queue.flush();

    expect(persist).toHaveBeenCalledTimes(1);
  });
});
