import type { StoredPayload } from "./storageTypes.js";

type PersistOperation = (payload: StoredPayload) => Promise<void>;

export type PersistenceQueue = {
  schedule: (payload: StoredPayload) => void;
  flush: () => Promise<void>;
};

export function createPersistenceQueue(options: {
  persist: PersistOperation;
  debounceMs?: number;
}): PersistenceQueue {
  const debounceMs = options.debounceMs ?? 300;
  let queuedPayload: StoredPayload | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let writing = Promise.resolve();

  const flush = async () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }

    const payload = queuedPayload;
    queuedPayload = null;
    if (!payload) return;

    writing = writing.then(async () => {
      await options.persist(payload);
    });
    await writing;

    if (queuedPayload) {
      await flush();
    }
  };

  const schedule = (payload: StoredPayload) => {
    queuedPayload = payload;
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      void flush();
    }, debounceMs);
  };

  return { schedule, flush };
}
