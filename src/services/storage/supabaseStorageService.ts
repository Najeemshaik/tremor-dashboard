import {
  SUPABASE_ANON_KEY_KEY,
  SUPABASE_TABLE_KEY,
  SUPABASE_URL_KEY
} from "../../core/constants.js";
import { normalizeStoredPayload, type StoredPayload } from "./storageTypes.js";

const DEFAULT_TABLE = "app_state";
const RECORD_ID = "default";
const TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const REQUEST_TIMEOUT_MS = 10000;

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  table: string;
};

export type SupabaseStatus = {
  configured: boolean;
  connected: boolean;
  message: string;
  url: string | null;
  table: string | null;
};

function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function normalizeTableName(table: string) {
  const value = table.trim();
  return value || DEFAULT_TABLE;
}

function getStorage() {
  return window.localStorage;
}

function getConfig(): SupabaseConfig | null {
  const storage = getStorage();
  const url = normalizeUrl(storage.getItem(SUPABASE_URL_KEY) ?? "");
  const anonKey = (storage.getItem(SUPABASE_ANON_KEY_KEY) ?? "").trim();
  const table = normalizeTableName(storage.getItem(SUPABASE_TABLE_KEY) ?? DEFAULT_TABLE);
  if (!url || !anonKey) return null;
  return { url, anonKey, table };
}

function assertValidConfig(config: SupabaseConfig) {
  try {
    const parsed = new URL(config.url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Supabase URL must use http or https.");
    }
  } catch (error) {
    throw new Error("Supabase URL is invalid.");
  }

  if (!config.anonKey) {
    throw new Error("Supabase anon key is required.");
  }

  if (!TABLE_NAME_PATTERN.test(config.table)) {
    throw new Error("Supabase table name is invalid.");
  }
}

function buildHeaders(config: SupabaseConfig) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    "Content-Type": "application/json"
  };
}

type RowPayload = { payload?: StoredPayload };

async function request(config: SupabaseConfig, url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Supabase request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function throwSupabaseError(prefix: string, response: Response): Promise<never> {
  let detail = "";
  try {
    detail = (await response.text()).trim();
  } catch (error) {
    detail = "";
  }
  const suffix = detail ? `: ${detail}` : "";
  throw new Error(`${prefix} (${response.status})${suffix}`);
}

async function readPayload(config: SupabaseConfig): Promise<StoredPayload | null> {
  assertValidConfig(config);
  const url = `${config.url}/rest/v1/${encodeURIComponent(
    config.table
  )}?id=eq.${encodeURIComponent(RECORD_ID)}&select=payload&limit=1`;
  const response = await request(config, url, {
    method: "GET",
    headers: buildHeaders(config)
  });
  if (!response.ok) {
    await throwSupabaseError("Supabase read failed", response);
  }
  const rows = (await response.json()) as unknown;
  if (!Array.isArray(rows)) return null;
  const first = rows[0];
  if (!first || typeof first !== "object") return null;
  const payload = normalizeStoredPayload((first as RowPayload).payload);
  return payload;
}

async function writePayload(config: SupabaseConfig, payload: StoredPayload) {
  assertValidConfig(config);
  const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}`;
  const body = JSON.stringify([
    {
      id: RECORD_ID,
      payload
    }
  ]);
  const response = await request(config, url, {
    method: "POST",
    headers: {
      ...buildHeaders(config),
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body
  });
  if (!response.ok) {
    await throwSupabaseError("Supabase write failed", response);
  }
}

export function getSupabaseConfig() {
  return getConfig();
}

export function saveSupabaseConfig(input: { url: string; anonKey: string; table?: string }) {
  const url = normalizeUrl(input.url);
  const anonKey = input.anonKey.trim();
  const table = normalizeTableName(input.table ?? DEFAULT_TABLE);
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required.");
  }
  assertValidConfig({ url, anonKey, table });
  const storage = getStorage();
  storage.setItem(SUPABASE_URL_KEY, url);
  storage.setItem(SUPABASE_ANON_KEY_KEY, anonKey);
  storage.setItem(SUPABASE_TABLE_KEY, table);
}

export function clearSupabaseConfig() {
  const storage = getStorage();
  storage.removeItem(SUPABASE_URL_KEY);
  storage.removeItem(SUPABASE_ANON_KEY_KEY);
  storage.removeItem(SUPABASE_TABLE_KEY);
}

export function isSupabaseConfigured() {
  return Boolean(getConfig());
}

export async function loadStoredDataFromSupabase(): Promise<StoredPayload | null> {
  const config = getConfig();
  if (!config) return null;
  return readPayload(config);
}

export async function persistStoredDataToSupabase(payload: StoredPayload): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;
  const normalized = normalizeStoredPayload(payload);
  if (!normalized) {
    throw new Error("Stored payload is invalid.");
  }
  await writePayload(config, normalized);
  return true;
}

export async function getSupabaseStatus(): Promise<SupabaseStatus> {
  const config = getConfig();
  if (!config) {
    return {
      configured: false,
      connected: false,
      message: "Supabase is not configured.",
      url: null,
      table: null
    };
  }
  try {
    await readPayload(config);
    return {
      configured: true,
      connected: true,
      message: `Connected to ${config.url}`,
      url: config.url,
      table: config.table
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      message: `Configured but unreachable: ${(error as Error).message}`,
      url: config.url,
      table: config.table
    };
  }
}
