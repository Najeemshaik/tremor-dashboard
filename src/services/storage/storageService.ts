import { STORAGE_KEY } from "../../core/constants.js";

export type StoredPayload = {
  profiles?: unknown;
  sequences?: unknown;
  sessions?: unknown;
};

export function loadStoredData(): StoredPayload | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredPayload;
  } catch (error) {
    return null;
  }
}

export function persistStoredData(payload: StoredPayload) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
