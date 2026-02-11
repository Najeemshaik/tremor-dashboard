import { STORAGE_KEY } from "../../core/constants.js";

export type StoredPayload = {
  profiles?: unknown;
  sequences?: unknown;
  sessions?: unknown;
};

export type StorageStatus = {
  supportsDirectoryPicker: boolean;
  usingDirectory: boolean;
  directoryName: string | null;
  readPermission: "granted" | "denied" | "prompt" | "unknown";
  writePermission: "granted" | "denied" | "prompt" | "unknown";
};

type DirectoryPermission = StorageStatus["readPermission"];

type DirectoryHandleLike = {
  name?: string;
  queryPermission?: (options: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    getFile: () => Promise<File>;
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

const HANDLE_DB_NAME = "tremor-storage-handles";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE_NAME = "handles";
const DIRECTORY_HANDLE_KEY = "data-directory";
const DATA_FILE_NAME = "tremor-data.json";

function loadStoredDataFromLocalStorage(): StoredPayload | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredPayload;
  } catch (error) {
    return null;
  }
}

function persistStoredDataToLocalStorage(payload: StoredPayload) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function isDirectoryPickerSupported() {
  return Boolean(
    window.isSecureContext &&
      typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
        "function" &&
      window.indexedDB
  );
}

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

async function readLinkedDirectoryHandle(): Promise<DirectoryHandleLike | null> {
  if (!isDirectoryPickerSupported()) return null;
  const db = await openHandleDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readonly");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = store.get(DIRECTORY_HANDLE_KEY);
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => {
      db.close();
      resolve((request.result as DirectoryHandleLike | undefined) ?? null);
    };
  });
}

async function writeLinkedDirectoryHandle(handle: DirectoryHandleLike) {
  if (!isDirectoryPickerSupported()) return;
  const db = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = store.put(handle, DIRECTORY_HANDLE_KEY);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function clearLinkedDirectoryHandle() {
  if (!isDirectoryPickerSupported()) return;
  const db = await openHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = store.delete(DIRECTORY_HANDLE_KEY);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function queryDirectoryPermission(
  handle: DirectoryHandleLike,
  mode: "read" | "readwrite"
): Promise<DirectoryPermission> {
  if (typeof handle.queryPermission !== "function") return "unknown";
  try {
    const value = await handle.queryPermission({ mode });
    if (value === "granted" || value === "denied" || value === "prompt") {
      return value;
    }
    return "unknown";
  } catch (error) {
    return "unknown";
  }
}

async function ensureDirectoryPermission(
  handle: DirectoryHandleLike,
  mode: "read" | "readwrite",
  requestPermission: boolean
) {
  const current = await queryDirectoryPermission(handle, mode);
  if (current === "granted" || current === "unknown") return true;
  if (!requestPermission || typeof handle.requestPermission !== "function") return false;
  try {
    return (await handle.requestPermission({ mode })) === "granted";
  } catch (error) {
    return false;
  }
}

async function readStoredDataFromDirectoryHandle(handle: DirectoryHandleLike): Promise<StoredPayload | null> {
  try {
    const fileHandle = await handle.getFileHandle(DATA_FILE_NAME);
    const file = await fileHandle.getFile();
    const content = await file.text();
    if (!content.trim()) return null;
    const parsed = JSON.parse(content) as StoredPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

async function writeStoredDataToDirectoryHandle(handle: DirectoryHandleLike, payload: StoredPayload) {
  const fileHandle = await handle.getFileHandle(DATA_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

export async function getStorageStatus(): Promise<StorageStatus> {
  if (!isDirectoryPickerSupported()) {
    return {
      supportsDirectoryPicker: false,
      usingDirectory: false,
      directoryName: null,
      readPermission: "unknown",
      writePermission: "unknown"
    };
  }

  try {
    const handle = await readLinkedDirectoryHandle();
    if (!handle) {
      return {
        supportsDirectoryPicker: true,
        usingDirectory: false,
        directoryName: null,
        readPermission: "prompt",
        writePermission: "prompt"
      };
    }

    const readPermission = await queryDirectoryPermission(handle, "read");
    const writePermission = await queryDirectoryPermission(handle, "readwrite");
    const readGranted = readPermission === "granted" || readPermission === "unknown";
    const writeGranted = writePermission === "granted" || writePermission === "unknown";

    return {
      supportsDirectoryPicker: true,
      usingDirectory: readGranted && writeGranted,
      directoryName: handle.name ?? null,
      readPermission,
      writePermission
    };
  } catch (error) {
    return {
      supportsDirectoryPicker: true,
      usingDirectory: false,
      directoryName: null,
      readPermission: "unknown",
      writePermission: "unknown"
    };
  }
}

export async function pickStorageDirectory() {
  if (!isDirectoryPickerSupported()) {
    throw new Error("Folder picker is unavailable in this browser.");
  }
  const picker = (window as unknown as {
    showDirectoryPicker: (options: { id: string; mode: "readwrite" }) => Promise<DirectoryHandleLike>;
  }).showDirectoryPicker;
  const handle = await picker({ id: "tremor-data-folder", mode: "readwrite" });
  const writeGranted = await ensureDirectoryPermission(handle, "readwrite", true);
  if (!writeGranted) {
    throw new Error("Write permission was not granted for the selected folder.");
  }
  await writeLinkedDirectoryHandle(handle);
  return getStorageStatus();
}

export async function clearStorageDirectory() {
  await clearLinkedDirectoryHandle();
  return getStorageStatus();
}

export async function loadStoredDataFromDirectory() {
  if (!isDirectoryPickerSupported()) return null;
  const handle = await readLinkedDirectoryHandle();
  if (!handle) return null;
  const canRead = await ensureDirectoryPermission(handle, "read", true);
  if (!canRead) return null;
  return readStoredDataFromDirectoryHandle(handle);
}

export async function loadStoredData(): Promise<StoredPayload | null> {
  if (isDirectoryPickerSupported()) {
    try {
      const handle = await readLinkedDirectoryHandle();
      if (handle) {
        const canRead = await ensureDirectoryPermission(handle, "read", false);
        if (canRead) {
          const folderData = await readStoredDataFromDirectoryHandle(handle);
          if (folderData) return folderData;
        }
      }
    } catch (error) {
      // Fall through to local storage fallback.
    }
  }
  return loadStoredDataFromLocalStorage();
}

export async function persistStoredData(payload: StoredPayload) {
  if (isDirectoryPickerSupported()) {
    try {
      const handle = await readLinkedDirectoryHandle();
      if (handle) {
        const canWrite = await ensureDirectoryPermission(handle, "readwrite", false);
        if (canWrite) {
          await writeStoredDataToDirectoryHandle(handle, payload);
          return;
        }
      }
    } catch (error) {
      // Fall through to local storage fallback.
    }
  }
  persistStoredDataToLocalStorage(payload);
}
