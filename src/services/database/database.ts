import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";
import { applyMigrations } from "./migrations.js";
import type { DatabasePort } from "./types.js";

const DB_STORAGE_KEY = "tremor-db";

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as { localStorage: Storage }).localStorage;
  }
  return null;
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  const bufferCtor = (globalThis as { Buffer?: any }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString("base64");
  }
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUint8Array(base64: string) {
  const bufferCtor = (globalThis as { Buffer?: any }).Buffer;
  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class DatabaseService implements DatabasePort {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    const SQL = await initSqlJs({
      locateFile: (file) => `./lib/${file}`
    });

    const storage = getStorage();
    const stored = storage?.getItem(DB_STORAGE_KEY) ?? null;
    let db: Database;

    if (stored) {
      try {
        const bytes = base64ToUint8Array(stored);
        db = new SQL.Database(bytes);
      } catch (error) {
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    db.exec("PRAGMA foreign_keys = ON");
    applyMigrations(db);

    this.SQL = SQL;
    this.db = db;
    this.initialized = true;
  }

  getDb() {
    if (!this.db) {
      throw new Error("DatabaseService not initialized");
    }
    return this.db;
  }

  persist() {
    if (!this.db) return;
    const storage = getStorage();
    if (!storage) return;
    const bytes = this.db.export();
    const base64 = uint8ArrayToBase64(bytes);
    storage.setItem(DB_STORAGE_KEY, base64);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
    this.db = null;
    this.SQL = null;
    this.initialized = false;
  }

  isInitialized() {
    return this.initialized;
  }
}
