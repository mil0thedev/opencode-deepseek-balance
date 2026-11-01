/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { createSignal } from "solid-js"
import {
  BalanceError,
  fetchBalance,
  formatMoney,
  isBalanceCache,
  primaryEntry,
  resolveApiKey,
  type Balance,
  type BalanceCache,
  type BalanceErrorKind,
} from "./balance.js"
import {
  billingState,
  countdown,
  formatChangeTime,
  holidayCalendarStatus,
  holidayFor,
  nextPeakChange,
} from "./peak.js"
import { retryDelay } from "./retry.js"
import { readPluginVersion } from "./version.js"

const REFRESH_MS = 60_000
const REFRESH_JITTER_MS = 5_000
const CLOCK_MS = 30_000
const STORAGE_KEY = "balance"
const LABEL_WIDTH = 10

type ViewState =
  | { status: "loading" }
  | { status: "ready"; balance: Balance; updatedAt: number }
  | { status: "stale"; balance: Balance; updatedAt: number; error?: BalanceError }
  | { status: "error"; error: BalanceError }

type CacheStore = {
  cache: BalanceCache | null
}

function formatAge(updatedAt: number, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - updatedAt) / 1_000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function errorLabel(error: BalanceError): string {
  const labels: Record<BalanceErrorKind, string> = {
    "no-key": "no key",
    unauthorized: "invalid key",
    insufficient: "insufficient",
    "rate-limited": "rate limited",
    network: "network error",
    timeout: "timeout",
    server: "API error",
    http: error.status ? `HTTP ${error.status}` : "HTTP error",
    "invalid-response": "bad response",
    aborted: "cancelled",
  }
  return labels[error.kind]
}

/**
 * Starts the sidebar widget. Only the TUI entrypoint calls this function; the
 * server entrypoint stays a no-op and never imports this module statically.
 */
export const start = (context: Context) => {
  const version = readPluginVersion()
  const [stored, updateStored] = context.storage.store<CacheStore>(STORAGE_KEY, {
    initial: { cache: null },
  })
  const cached = stored.cache
  const initial: ViewState = isBalanceCache(cached)
    ? { status: "stale", balance: cached.balance, updatedAt: cached.updatedAt }
    : { status: "loading" }

  const [state, setState] = createSignal<ViewState>(initial)
  const [now, setNow] = createSignal(new Date())
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let clockTimer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let inFlight: Promise<BalanceError | undefined> | undefined
  let attempt = 0

  const setFailure = (error: BalanceError) => {
    setState((previous) => {
      if (previous.status === "ready" || previous.status === "stale") {
        return {
          status: "stale",
          balance: previous.balance,
          updatedAt: previous.updatedAt,
          error,
        }
      }
      return { status: "error", error }
    })
  }

  const refresh = async (): Promise<BalanceError | undefined> => {
    if (inFlight) return inFlight

    const resolved = resolveApiKey()
    if (!resolved) {
      const error = new BalanceError("no-key", "No DeepSeek API key configured")
      setFailure(error)
      return error
    }

    const requestController = new AbortController()
    controller = requestController
    const request = (async () => {
      try {
        const balance = await fetchBalance(resolved.key, { signal: requestController.signal })
        if (disposed) return
        const updatedAt = Date.now()
        setState({ status: "ready", balance, updatedAt })
        const cache: BalanceCache = { balance, updatedAt }
        void updateStored((draft) => {
          draft.cache = cache
        }).catch(() => {
          // The cache is an optimization; a write failure must not hide a valid balance.
        })
        return
      } catch (error) {
        const balanceError =
          error instanceof BalanceError
            ? error
            : new BalanceError("network", "Unexpected balance error", { cause: error })
        if (disposed || balanceError.kind === "aborted") return balanceError
        setFailure(balanceError)
        return balanceError
      }
    })()

    inFlight = request
    try {
      return await request
    } finally {
      if (inFlight === request) inFlight = undefined
      if (controller === requestController) controller = undefined
    }
  }

  const scheduleNext = (error?: BalanceError) => {
    if (disposed) return
    let delay: number
    if (error) {
      attempt += 1
      delay = retryDelay(error.kind, { attempt, retryAfterMs: error.retryAfterMs })
    } else {
      attempt = 0
      delay = REFRESH_MS + Math.floor(Math.random() * REFRESH_JITTER_MS)
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void runRefresh(), delay)
  }

  const runRefresh = async () => {
    if (disposed) return
    if (inFlight) {
      await inFlight
      return
    }
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    let error: BalanceError | undefined
    try {
      error = await refresh()
    } catch (cause) {
      error = new BalanceError("network", "Unexpected refresh error", { cause })
      setFailure(error)
    }
    if (disposed || error?.kind === "aborted") return
    scheduleNext(error)
  }

  const tick = () => {
    if (disposed) return
    const current = new Date()
    setNow(current)
    const change = nextPeakChange(current)
    const untilChange = change ? change.getTime() - current.getTime() : CLOCK_MS
    const delay = Math.max(250, Math.min(CLOCK_MS, untilChange + 100))
    clockTimer = setTimeout(tick, delay)
  }

  void runRefresh()
  clockTimer = setTimeout(tick, CLOCK_MS)
  const offIdle = context.data.on("session.idle", () => void runRefresh())

  const unregister = context.ui.slot({
    append: "sidebar.footer",
    render: () => {
      const theme = context.theme

      const statusColor = () => {
        const current = state()
        if (current.status === "error") return theme.text.feedback.error.base
        if (current.status === "stale" && current.error) return theme.text.feedback.warning.base
        return theme.text.muted
      }

      const statusText = () => {
        const current = state()
        if (current.status === "loading") return "checking…"
        if (current.status === "error") return "retrying"
        const age = formatAge(current.updatedAt, now())
        if (current.status === "stale") {
          return current.error ? `${errorLabel(current.error)} · ${age}` : `cached · ${age}`
        }
        return version ? `${version}` : `updated ${age}`
      }

      const balanceText = () => {
        const current = state()
        if (current.status === "loading") return "…"
        if (current.status === "error") return errorLabel(current.error)
        if (!current.balance.isAvailable) return "insufficient"
        const entry = primaryEntry(current.balance)
        return entry ? formatMoney(entry.total, entry.currency) : "n/a"
      }

      const balanceColor = () => {
        const current = state()
        if (current.status === "loading") return theme.text.muted
        if (current.status === "error") return theme.text.feedback.error.base
        if (!current.balance.isAvailable) return theme.text.feedback.error.base
        if (current.status === "stale") return theme.text.feedback.warning.base
        return theme.text.feedback.success.base
      }

      const billing = () => billingState(now())
      const holiday = () => holidayFor(now())
      const peakLabel = () => {
        if (billing() === "peak") return "Peak"
        if (billing() === "holiday") return holiday()?.provisional ? "Holiday*" : "Holiday"
        return "Off-peak"
      }
      const peakColor = () =>
        billing() === "peak" ? theme.text.feedback.warning.base : theme.text.feedback.success.base
      const price = () => {
        const mode = billing()
        return mode === "peak" ? "2× rate" : mode === "holiday" ? "off-peak all day" : "50% off"
      }
      const next = () => {
        const change = nextPeakChange(now())
        if (!change) return undefined
        const peak = billingState(change) === "peak"
        return {
          label: peak ? "→ Peak" : "→ Off-peak",
          color: peak ? theme.text.feedback.warning.base : theme.text.feedback.success.base,
          detail: `${countdown(change, now())} · ${formatChangeTime(change, now())}`,
        }
      }
      const calendarNote = () => {
        const status = holidayCalendarStatus(now())
        if (status === "missing") return "holiday calendar outdated"
        if (status === "provisional" && billing() === "holiday") return "holiday dates provisional"
        return undefined
      }

      return (
        <box flexDirection="column" flexShrink={0}>
          <box flexDirection="row" gap={1} flexShrink={0}>
            <text fg={theme.text.base}>
              <strong>DeepSeek Usage</strong>
            </text>
            <text fg={statusColor()} opacity={0.7} selectable={false}>
              {statusText()}
            </text>
          </box>
          <box flexDirection="row" gap={1} flexShrink={0}>
            <text fg={theme.text.muted} width={LABEL_WIDTH}>
              DeepSeek
            </text>
            <text fg={balanceColor()}>{balanceText()}</text>
          </box>
          <box flexDirection="row" gap={1} flexShrink={0}>
            <text fg={peakColor()} width={LABEL_WIDTH}>
              {peakLabel()}
            </text>
            <text fg={theme.text.muted}>{price()}</text>
          </box>
          {(() => {
            const change = next()
            if (!change) return null
            return (
              <box flexDirection="row" gap={1} flexShrink={0}>
                <text fg={change.color} width={LABEL_WIDTH}>
                  {change.label}
                </text>
                <text fg={theme.text.muted}>{change.detail}</text>
              </box>
            )
          })()}
          {calendarNote() ? (
            <text fg={theme.text.feedback.warning.base} opacity={0.8}>
              {calendarNote()}
            </text>
          ) : null}
        </box>
      )
    },
  })

  return () => {
    disposed = true
    if (timer) clearTimeout(timer)
    if (clockTimer) clearTimeout(clockTimer)
    controller?.abort()
    offIdle()
    unregister()
  }
}

export default Plugin.define({
  id: "deepseek-balance",
  setup: start,
})
