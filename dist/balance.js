import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export class BalanceError extends Error {
  constructor(kind, message, options = {}) {
    super(message, {
      cause: options.cause
    });
    this.name = "BalanceError";
    this.kind = kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}
const authCache = new Map();
export function authFilePaths() {
  if (process.env.OPENCODE_AUTH_FILE) return [process.env.OPENCODE_AUTH_FILE];
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return [join(dataHome, "opencode", "auth.json"), join(configHome, "opencode", "auth.json")];
}
export function authFilePath() {
  return authFilePaths()[0];
}
function asRecord(value) {
  return value && typeof value === "object" ? value : undefined;
}
function asString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
function isDeepSeekID(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").includes("deepseek");
}
function extractKey(value, depth = 0) {
  if (depth > 3) return undefined;
  const direct = asString(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = extractKey(entry, depth + 1);
      if (key) return key;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  for (const field of ["key", "apiKey", "token"]) {
    const key = asString(record[field]);
    if (key) return key;
  }
  for (const nested of ["value", "credentials"]) {
    const key = extractKey(record[nested], depth + 1);
    if (key) return key;
  }
  return undefined;
}
function extractAuthKey(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry);
      if (!record) continue;
      const id = asString(record.integrationID) ?? asString(record.providerID) ?? asString(record.id);
      if (!id || !isDeepSeekID(id)) continue;
      const key = extractKey(record.value) ?? extractKey(record.credentials) ?? extractKey(record);
      if (key) return key;
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  for (const [id, entry] of Object.entries(record)) {
    if (!isDeepSeekID(id)) continue;
    const key = extractKey(entry);
    if (key) return key;
  }
  return undefined;
}
function readAuthFileKey(path) {
  try {
    const stat = statSync(path);
    const cached = authCache.get(path);
    if (cached?.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.key;
    let key;
    try {
      key = extractAuthKey(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      key = undefined;
    }
    authCache.set(path, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      key
    });
    return key;
  } catch {
    authCache.delete(path);
    return undefined;
  }
}
export function resolveApiKey(options = {}) {
  const paths = options.authFiles ?? (options.authFile ? [options.authFile] : authFilePaths());
  for (const path of paths) {
    const authKey = readAuthFileKey(path);
    if (authKey) return {
      key: authKey,
      source: "auth"
    };
  }
  const envKey = (options.env ?? process.env).DEEPSEEK_API_KEY?.trim();
  return envKey ? {
    key: envKey,
    source: "env"
  } : undefined;
}
export function readApiKey() {
  return resolveApiKey()?.key;
}
function stringField(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}
function parseEntry(value) {
  if (!value || typeof value !== "object") return undefined;
  const record = value;
  const currency = stringField(record.currency);
  const total = stringField(record.total_balance);
  if (!currency || total === undefined) return undefined;
  return {
    currency,
    total,
    granted: stringField(record.granted_balance) ?? "0",
    toppedUp: stringField(record.topped_up_balance) ?? "0"
  };
}
export function parseBalance(value) {
  if (!value || typeof value !== "object") return undefined;
  const record = value;
  if (typeof record.is_available !== "boolean") return undefined;
  if (!Array.isArray(record.balance_infos) || record.balance_infos.length === 0) return undefined;
  const entries = [];
  for (const item of record.balance_infos) {
    const entry = parseEntry(item);
    if (!entry) return undefined;
    entries.push(entry);
  }
  return {
    isAvailable: record.is_available,
    entries
  };
}
function isEntry(value) {
  if (!value || typeof value !== "object") return false;
  const record = value;
  return typeof record.currency === "string" && typeof record.total === "string" && typeof record.granted === "string" && typeof record.toppedUp === "string";
}
export function isBalance(value) {
  if (!value || typeof value !== "object") return false;
  const record = value;
  return typeof record.isAvailable === "boolean" && Array.isArray(record.entries) && record.entries.length > 0 && record.entries.every(isEntry);
}
export function isBalanceCache(value) {
  if (!value || typeof value !== "object") return false;
  const record = value;
  return isBalance(record.balance) && typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt);
}
export function primaryEntry(balance) {
  return balance.entries[0];
}
export function formatMoney(value, currency, locale) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${value} ${currency}`;
  }
}
function parseRetryAfter(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, date - Date.now());
}
function httpError(status, retryAfter) {
  const kind = status === 401 || status === 403 ? "unauthorized" : status === 402 ? "insufficient" : status === 429 ? "rate-limited" : status >= 500 ? "server" : "http";
  return new BalanceError(kind, `DeepSeek balance request failed with HTTP ${status}`, {
    status,
    retryAfterMs: parseRetryAfter(retryAfter)
  });
}
export async function fetchBalance(key, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;
  const baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/+$/, "");
  if (options.signal?.aborted) throw new BalanceError("aborted", "Balance request was aborted");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, {
    once: true
  });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/user/balance`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json"
      },
      signal: controller.signal
    });
    if (!response.ok) throw httpError(response.status, response.headers.get("retry-after"));
    let body;
    try {
      body = await response.json();
    } catch (cause) {
      throw new BalanceError("invalid-response", "DeepSeek returned invalid JSON", {
        cause
      });
    }
    const balance = parseBalance(body);
    if (!balance) throw new BalanceError("invalid-response", "DeepSeek returned an unexpected balance response");
    return balance;
  } catch (error) {
    if (error instanceof BalanceError) throw error;
    if (options.signal?.aborted) {
      throw new BalanceError("aborted", "Balance request was aborted", {
        cause: error
      });
    }
    if (controller.signal.aborted) {
      throw new BalanceError("timeout", `Balance request timed out after ${timeoutMs}ms`, {
        cause: error
      });
    }
    throw new BalanceError("network", "Balance request failed", {
      cause: error
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
//# sourceMappingURL=balance.js.map