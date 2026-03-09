import { SUPABASE_CONFIG_FILE_KEY } from "../../core/constants.js";
import {
  clearSupabaseConfig,
  getSupabaseStatus,
  isSupabaseConfigured,
  loadStoredDataFromSupabase,
  persistStoredDataToSupabase,
  saveSupabaseConfig,
  type SupabaseStatus
} from "./supabaseStorageService.js";
import { normalizeStoredPayload, type StoredPayload } from "./storageTypes.js";

export type { StoredPayload } from "./storageTypes.js";

const HANDLE_DB_NAME = "tremor-storage-handles";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE_NAME = "handles";

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(HANDLE_DB_NAME, HANDLE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readConfigFileHandle(): Promise<FileSystemFileHandle | null> {
  if (!window.indexedDB) return null;
  const db = await openHandleDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readonly");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = store.get(SUPABASE_CONFIG_FILE_KEY);
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => {
      db.close();
      resolve((request.result as FileSystemFileHandle | undefined) ?? null);
    };
  });
}

async function writeConfigFileHandle(handle: FileSystemFileHandle) {
  if (!window.indexedDB) return;
  const db = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    store.put(handle, SUPABASE_CONFIG_FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function clearConfigFileHandle() {
  if (!window.indexedDB) return;
  const db = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    store.delete(SUPABASE_CONFIG_FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

type SupabaseConfigFileContent = { url: string; anonKey: string; table?: string };

async function parseConfigFile(file: File): Promise<SupabaseConfigFileContent> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Config file is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Config file must be a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj["url"] !== "string" || !obj["url"]) {
    throw new Error('Config file must have a "url" string field.');
  }
  if (typeof obj["anonKey"] !== "string" || !obj["anonKey"]) {
    throw new Error('Config file must have an "anonKey" string field.');
  }
  const result: SupabaseConfigFileContent = { url: obj["url"], anonKey: obj["anonKey"] };
  if (typeof obj["table"] === "string" && obj["table"]) {
    result.table = obj["table"];
  }
  return result;
}

export async function loadSupabaseConfigFromFilePicker(): Promise<SupabaseConfigFileContent> {
  const picker = (window as unknown as {
    showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
  }).showOpenFilePicker;
  if (typeof picker !== "function") {
    throw new Error("File picker is not supported in this browser.");
  }
  const [handle] = await picker({
    types: [{ description: "JSON config", accept: { "application/json": [".json"] } }],
    multiple: false
  });
  const file = await handle.getFile();
  const config = await parseConfigFile(file);
  await writeConfigFileHandle(handle);
  return config;
}

export async function tryLoadSupabaseConfigFromStoredFile(): Promise<SupabaseConfigFileContent | null> {
  try {
    const handle = await readConfigFileHandle();
    if (!handle) return null;
    const file = await handle.getFile();
    return await parseConfigFile(file);
  } catch {
    return null;
  }
}

export async function clearSupabaseConfigFile(): Promise<void> {
  await clearConfigFileHandle();
}

export async function loadStoredData(): Promise<StoredPayload | null> {
  if (!isSupabaseConfigured()) return null;
  return loadStoredDataFromSupabase();
}

export async function persistStoredData(payload: StoredPayload) {
  const normalized = normalizeStoredPayload(payload);
  if (!normalized) return;
  if (!isSupabaseConfigured()) return;
  await persistStoredDataToSupabase(normalized);
}

export function saveSupabaseStorageConfig(input: { url: string; anonKey: string; table?: string }) {
  return saveSupabaseConfig(input);
}

export function clearSupabaseStorageConfig() {
  clearSupabaseConfig();
}

export function isSupabaseStorageConfigured() {
  return isSupabaseConfigured();
}

export function getSupabaseStorageStatus(): Promise<SupabaseStatus> {
  return getSupabaseStatus();
}
