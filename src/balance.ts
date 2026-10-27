import { readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type BalanceEntry = {
  currency: string
  total: string
  granted: string
  toppedUp: string
}

export type Balance = {
  isAvailable: boolean
  entries: BalanceEntry[]
}

export type BalanceCache = {
  balance: Balance
  updatedAt: number
}

export type BalanceErrorKind =
  | "no-key"
  | "unauthorized"
  | "insufficient"
  | "rate-limited"
  | "network"
  | "timeout"
  | "server"
  | "http"
  | "invalid-response"
  | "aborted"

export type BalanceErrorOptions = {
  status?: number
  retryAfterMs?: number
  cause?: unknown
}

export class BalanceError extends Error {
  readonly kind: BalanceErrorKind
  readonly status?: number
  readonly retryAfterMs?: number

  constructor(kind: BalanceErrorKind, message: string, options: BalanceErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = "BalanceError"
    this.kind = kind
    this.status = options.status
    this.retryAfterMs = options.retryAfterMs
  }
}

export type ApiKey = {
  key: string
  source: "auth" | "env"
}

export type ResolveApiKeyOptions = {
  authFile?: string
  authFiles?: string[]
  env?: NodeJS.ProcessEnv
}

type AuthCache = {
  mtimeMs: number
  size: number
  key?: string
}

const authCache = new Map<string, AuthCache>()

export function authFilePaths(): string[] {
  if (process.env.OPENCODE_AUTH_FILE) return [process.env.OPENCODE_AUTH_FILE]
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share")
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return [
    join(dataHome, "opencode", "auth.json"),
    join(configHome, "opencode", "auth.json"),
  ]
}

export function authFilePath(): string {
  return authFilePaths()[0]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isDeepSeekID(value: string): boolean {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").includes("deepseek")
}

function extractKey(value: unknown, depth = 0): string | undefined {
  if (depth > 3) return undefined
  const direct = asString(value)
  if (direct) return direct
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = extractKey(entry, depth + 1)
      if (key) return key
    }
    return undefined
  }
  const record = asRecord(value)
  if (!record) return undefined
  for (const field of ["key", "apiKey", "token"]) {
    const key = asString(record[field])
    if (key) return key
  }
  for (const nested of ["value", "credentials"]) {
    const key = extractKey(record[nested], depth + 1)
    if (key) return key
  }
  return undefined
}

function extractAuthKey(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry)
      if (!record) continue
      const id =
        asString(record.integrationID) ??
        asString(record.providerID) ??
        asString(record.id)
      if (!id || !isDeepSeekID(id)) continue
      const key = extractKey(record.value) ?? extractKey(record.credentials) ?? extractKey(record)
      if (key) return key
    }
    return undefined
  }

  const record = asRecord(value)
  if (!record) return undefined
  for (const [id, entry] of Object.entries(record)) {
    if (!isDeepSeekID(id)) continue
    const key = extractKey(entry)
    if (key) return key
  }
  return undefined
}

function readAuthFileKey(path: string): string | undefined {
  try {
    const stat = statSync(path)
    const cached = authCache.get(path)
    if (cached?.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.key

    let key: string | undefined
    try {
      key = extractAuthKey(JSON.parse(readFileSync(path, "utf8")))
    } catch {
      key = undefined
    }
    authCache.set(path, { mtimeMs: stat.mtimeMs, size: stat.size, key })
    return key
  } catch {
    authCache.delete(path)
    return undefined
  }
}

export function resolveApiKey(options: ResolveApiKeyOptions = {}): ApiKey | undefined {
  const paths = options.authFiles ?? (options.authFile ? [options.authFile] : authFilePaths())
  for (const path of paths) {
    const authKey = readAuthFileKey(path)
    if (authKey) return { key: authKey, source: "auth" }
  }

  const envKey = (options.env ?? process.env).DEEPSEEK_API_KEY?.trim()
  return envKey ? { key: envKey, source: "env" } : undefined
}

export function readApiKey(): string | undefined {
  return resolveApiKey()?.key
}

function stringField(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}

function parseEntry(value: unknown): BalanceEntry | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  const currency = stringField(record.currency)
  const total = stringField(record.total_balance)
  if (!currency || total === undefined) return undefined
  return {
    currency,
    total,
    granted: stringField(record.granted_balance) ?? "0",
    toppedUp: stringField(record.topped_up_balance) ?? "0",
  }
}

export function parseBalance(value: unknown): Balance | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  if (typeof record.is_available !== "boolean") return undefined
  if (!Array.isArray(record.balance_infos) || record.balance_infos.length === 0) return undefined

  const entries: BalanceEntry[] = []
  for (const item of record.balance_infos) {
    const entry = parseEntry(item)
    if (!entry) return undefined
    entries.push(entry)
  }
  return { isAvailable: record.is_available, entries }
}

function isEntry(value: unknown): value is BalanceEntry {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.currency === "string" &&
    typeof record.total === "string" &&
    typeof record.granted === "string" &&
    typeof record.toppedUp === "string"
  )
}

export function isBalance(value: unknown): value is Balance {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.isAvailable === "boolean" &&
    Array.isArray(record.entries) &&
    record.entries.length > 0 &&
    record.entries.every(isEntry)
  )
}

export function isBalanceCache(value: unknown): value is BalanceCache {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return isBalance(record.balance) && typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
}

export function primaryEntry(balance: Balance): BalanceEntry | undefined {
  return balance.entries[0]
}

export function formatMoney(value: string, currency: string, locale?: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${value} ${currency}`
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${value} ${currency}`
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000)
  const date = Date.parse(value)
  if (!Number.isFinite(date)) return undefined
  return Math.max(0, date - Date.now())
}

function httpError(status: number, retryAfter: string | null): BalanceError {
  const kind: BalanceErrorKind =
    status === 401 || status === 403
      ? "unauthorized"
      : status === 402
        ? "insufficient"
        : status === 429
          ? "rate-limited"
          : status >= 500
            ? "server"
            : "http"
  return new BalanceError(kind, `DeepSeek balance request failed with HTTP ${status}`, {
    status,
    retryAfterMs: parseRetryAfter(retryAfter),
  })
}

export type FetchBalanceOptions = {
  signal?: AbortSignal
  timeoutMs?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
}

export async function fetchBalance(key: string, options: FetchBalanceOptions = {}): Promise<Balance> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 5_000
  const baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/+$/, "")

  if (options.signal?.aborted) throw new BalanceError("aborted", "Balance request was aborted")

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener("abort", onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(`${baseUrl}/user/balance`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
    if (!response.ok) throw httpError(response.status, response.headers.get("retry-after"))

    let body: unknown
    try {
      body = await response.json()
    } catch (cause) {
      throw new BalanceError("invalid-response", "DeepSeek returned invalid JSON", { cause })
    }
    const balance = parseBalance(body)
    if (!balance) throw new BalanceError("invalid-response", "DeepSeek returned an unexpected balance response")
    return balance
  } catch (error) {
    if (error instanceof BalanceError) throw error
    if (options.signal?.aborted) {
      throw new BalanceError("aborted", "Balance request was aborted", { cause: error })
    }
    if (controller.signal.aborted) {
      throw new BalanceError("timeout", `Balance request timed out after ${timeoutMs}ms`, { cause: error })
    }
    throw new BalanceError("network", "Balance request failed", { cause: error })
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener("abort", onAbort)
  }
}
