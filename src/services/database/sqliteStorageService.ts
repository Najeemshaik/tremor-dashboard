import { STORAGE_KEY } from "../../core/constants.js";
import type { StoredPayload } from "./types.js";
import type { DatabaseService } from "./database.js";
import type { ProfileRepository, SequenceRepository, SessionRepository } from "./types.js";

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as { localStorage: Storage }).localStorage;
  }
  return null;
}

export class SqliteStorageService {
  private database: DatabaseService;
  private profileRepository: ProfileRepository;
  private sequenceRepository: SequenceRepository;
  private sessionRepository: SessionRepository;

  constructor(options: {
    database: DatabaseService;
    profileRepository: ProfileRepository;
    sequenceRepository: SequenceRepository;
    sessionRepository: SessionRepository;
  }) {
    this.database = options.database;
    this.profileRepository = options.profileRepository;
    this.sequenceRepository = options.sequenceRepository;
    this.sessionRepository = options.sessionRepository;
  }

  loadStoredData(): StoredPayload | null {
    if (this.isDatabaseEmpty()) {
      const legacy = this.loadLegacyStorage();
      if (!legacy) {
        return null;
      }
      this.persistStoredData(legacy);
      const storage = getStorage();
      storage?.removeItem(STORAGE_KEY);
      return legacy;
    }

    return {
      profiles: this.profileRepository.getAll(),
      sequences: this.sequenceRepository.getAll(),
      sessions: this.sessionRepository.getAll()
    };
  }

  persistStoredData(payload: StoredPayload) {
    if (payload.profiles) {
      this.profileRepository.replaceAll(payload.profiles);
    }
    if (payload.sequences) {
      this.sequenceRepository.replaceAll(payload.sequences);
    }
    if (payload.sessions) {
      this.sessionRepository.replaceAll(payload.sessions);
    }
    this.database.persist();
  }

  private isDatabaseEmpty() {
    const db = this.database.getDb();
    const tables = ["profile", "sequence", "session"];
    return !tables.some((table) => {
      const result = db.exec(`SELECT 1 FROM ${table} LIMIT 1`);
      return result.length > 0 && result[0].values.length > 0;
    });
  }

  private loadLegacyStorage(): StoredPayload | null {
    const storage = getStorage();
    const stored = storage?.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as StoredPayload;
      return {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        sequences: Array.isArray(parsed.sequences) ? parsed.sequences : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
      };
    } catch (error) {
      return null;
    }
  }
}
