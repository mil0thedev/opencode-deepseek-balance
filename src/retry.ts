import type { BalanceErrorKind } from "./balance.js"

export type RetryOptions = {
  attempt: number
  retryAfterMs?: number
  random?: () => number
}

const BASE_DELAY_MS = 5_000
const MAX_DELAY_MS = 5 * 60_000
const MAX_RATE_LIMIT_DELAY_MS = 30 * 60_000
const JITTER_MS = 2_000

export function retryDelay(kind: BalanceErrorKind, options: RetryOptions): number {
  if (kind === "aborted") return 0

  const attempt = Math.max(1, options.attempt)
  let base: number
  switch (kind) {
    case "no-key":
      base = 60_000
      break
    case "unauthorized":
      base = 5 * 60_000
      break
    case "insufficient":
      base = 60_000
      break
    case "rate-limited":
      base = Math.max(options.retryAfterMs ?? 0, 60_000)
      break
    case "network":
    case "timeout":
    case "server":
      base = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)
      break
    case "invalid-response":
    case "http":
      base = Math.min(30_000 * 2 ** (attempt - 1), MAX_DELAY_MS)
      break
  }

  const jitter = Math.floor(Math.max(0, Math.min(1, (options.random ?? Math.random)())) * JITTER_MS)
  const max = kind === "rate-limited" ? MAX_RATE_LIMIT_DELAY_MS : MAX_DELAY_MS
  return Math.min(base + jitter, max + JITTER_MS)
}
