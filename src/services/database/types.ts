import type { Database } from "sql.js";
import type { Profile, Sequence, Session } from "../../state/types.js";

export type DatabasePort = {
  init: () => Promise<void>;
  getDb: () => Database;
  close: () => void;
  persist: () => void;
  isInitialized: () => boolean;
};

export type ProfileRepository = {
  getAll: () => Profile[];
  replaceAll: (profiles: Profile[]) => void;
};

export type SequenceRepository = {
  getAll: () => Sequence[];
  replaceAll: (sequences: Sequence[]) => void;
};

export type SessionRepository = {
  getAll: () => Session[];
  replaceAll: (sessions: Session[]) => void;
};

export type StoredPayload = {
  profiles?: Profile[];
  sequences?: Sequence[];
  sessions?: Session[];
};
