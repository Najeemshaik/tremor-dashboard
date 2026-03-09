import type { Profile, Sequence, Session } from "../../state/types.js";

export type StoredPayload = {
  profiles?: Profile[];
  sequences?: Sequence[];
  sessions?: Session[];
};

type PayloadLike = {
  profiles?: unknown;
  sequences?: unknown;
  sessions?: unknown;
};

export function normalizeStoredPayload(payload: unknown): StoredPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as PayloadLike;
  const profiles = Array.isArray(candidate.profiles) ? candidate.profiles : undefined;
  const sequences = Array.isArray(candidate.sequences) ? candidate.sequences : undefined;
  const sessions = Array.isArray(candidate.sessions) ? candidate.sessions : undefined;

  if (!profiles && !sequences && !sessions) return null;
  return { profiles, sequences, sessions };
}
