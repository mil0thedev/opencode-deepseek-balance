import { effect as _$effect } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/** @jsxImportSource @opentui/solid */

import { createSignal } from "solid-js";
import { BalanceError, fetchBalance, formatMoney, isBalanceCache, primaryEntry, resolveApiKey } from "./balance.js";
import { billingState, countdown, formatChangeTime, holidayCalendarStatus, holidayFor, nextPeakChange } from "./peak.js";
import { retryDelay } from "./retry.js";
import { readPluginVersion } from "./version.js";
const REFRESH_MS = 60_000;
const REFRESH_JITTER_MS = 5_000;
const CLOCK_MS = 30_000;
const CACHE_KEY = "opencode-deepseek-balance.balance";
const LABEL_WIDTH = 10;
function formatAge(updatedAt, now) {
  const seconds = Math.max(0, Math.floor((now.getTime() - updatedAt) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function errorLabel(error) {
  const labels = {
    "no-key": "no key",
    unauthorized: "invalid key",
    insufficient: "insufficient",
    "rate-limited": "rate limited",
    network: "network error",
    timeout: "timeout",
    server: "API error",
    http: error.status ? `HTTP ${error.status}` : "HTTP error",
    "invalid-response": "bad response",
    aborted: "cancelled"
  };
  return labels[error.kind];
}
const tui = async api => {
  const version = readPluginVersion();
  let cached;
  try {
    cached = api.kv.get(CACHE_KEY);
  } catch {
    cached = undefined;
  }
  const initial = isBalanceCache(cached) ? {
    status: "stale",
    balance: cached.balance,
    updatedAt: cached.updatedAt
  } : {
    status: "loading"
  };
  const [state, setState] = createSignal(initial);
  const [now, setNow] = createSignal(new Date());
  let disposed = false;
  let timer;
  let clockTimer;
  let controller;
  let inFlight;
  let attempt = 0;
  const setFailure = error => {
    setState(previous => {
      if (previous.status === "ready" || previous.status === "stale") {
        return {
          status: "stale",
          balance: previous.balance,
          updatedAt: previous.updatedAt,
          error
        };
      }
      return {
        status: "error",
        error
      };
    });
  };
  const refresh = async () => {
    if (inFlight) return inFlight;
    const resolved = resolveApiKey();
    if (!resolved) {
      const error = new BalanceError("no-key", "No DeepSeek API key configured");
      setFailure(error);
      return error;
    }
    const requestController = new AbortController();
    controller = requestController;
    const request = (async () => {
      try {
        const balance = await fetchBalance(resolved.key, {
          signal: requestController.signal
        });
        if (disposed) return;
        const updatedAt = Date.now();
        setState({
          status: "ready",
          balance,
          updatedAt
        });
        const cache = {
          balance,
          updatedAt
        };
        try {
          api.kv.set(CACHE_KEY, cache);
        } catch {
          // The cache is an optimization; a write failure must not hide a valid balance.
        }
        return;
      } catch (error) {
        const balanceError = error instanceof BalanceError ? error : new BalanceError("network", "Unexpected balance error", {
          cause: error
        });
        if (disposed || balanceError.kind === "aborted") return balanceError;
        setFailure(balanceError);
        return balanceError;
      }
    })();
    inFlight = request;
    try {
      return await request;
    } finally {
      if (inFlight === request) inFlight = undefined;
      if (controller === requestController) controller = undefined;
    }
  };
  const scheduleNext = error => {
    if (disposed) return;
    let delay;
    if (error) {
      attempt += 1;
      delay = retryDelay(error.kind, {
        attempt,
        retryAfterMs: error.retryAfterMs
      });
    } else {
      attempt = 0;
      delay = REFRESH_MS + Math.floor(Math.random() * REFRESH_JITTER_MS);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void runRefresh(), delay);
  };
  const runRefresh = async () => {
    if (disposed) return;
    if (inFlight) {
      await inFlight;
      return;
    }
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    let error;
    try {
      error = await refresh();
    } catch (cause) {
      error = new BalanceError("network", "Unexpected refresh error", {
        cause
      });
      setFailure(error);
    }
    if (disposed || error?.kind === "aborted") return;
    scheduleNext(error);
  };
  const tick = () => {
    if (disposed) return;
    const current = new Date();
    setNow(current);
    const change = nextPeakChange(current);
    const untilChange = change ? change.getTime() - current.getTime() : CLOCK_MS;
    const delay = Math.max(250, Math.min(CLOCK_MS, untilChange + 100));
    clockTimer = setTimeout(tick, delay);
  };
  void runRefresh();
  clockTimer = setTimeout(tick, CLOCK_MS);
  const offIdle = api.event.on("session.idle", () => void runRefresh());
  api.lifecycle.onDispose(() => {
    disposed = true;
    if (timer) clearTimeout(timer);
    if (clockTimer) clearTimeout(clockTimer);
    controller?.abort();
    offIdle();
  });
  api.slots.register({
    order: 95,
    slots: {
      sidebar_footer() {
        const statusColor = () => {
          const current = state();
          if (current.status === "error") return api.theme.current.error;
          if (current.status === "stale" && current.error) return api.theme.current.warning;
          return api.theme.current.textMuted;
        };
        const statusText = () => {
          const current = state();
          if (current.status === "loading") return "checking…";
          if (current.status === "error") return "retrying";
          const age = formatAge(current.updatedAt, now());
          if (current.status === "stale") {
            return current.error ? `${errorLabel(current.error)} · ${age}` : `cached · ${age}`;
          }
          return version ? `${version}` : `updated ${age}`;
        };
        const balanceText = () => {
          const current = state();
          if (current.status === "loading") return "…";
          if (current.status === "error") return errorLabel(current.error);
          if (!current.balance.isAvailable) return "insufficient";
          const entry = primaryEntry(current.balance);
          return entry ? formatMoney(entry.total, entry.currency) : "n/a";
        };
        const balanceColor = () => {
          const current = state();
          if (current.status === "loading") return api.theme.current.textMuted;
          if (current.status === "error") return api.theme.current.error;
          if (!current.balance.isAvailable) return api.theme.current.error;
          if (current.status === "stale") return api.theme.current.warning;
          return api.theme.current.success;
        };
        const billing = () => billingState(now());
        const holiday = () => holidayFor(now());
        const peakLabel = () => {
          if (billing() === "peak") return "Peak";
          if (billing() === "holiday") return holiday()?.provisional ? "Holiday*" : "Holiday";
          return "Off-peak";
        };
        const peakColor = () => billing() === "peak" ? api.theme.current.warning : api.theme.current.success;
        const price = () => {
          const mode = billing();
          return mode === "peak" ? "2× rate" : mode === "holiday" ? "off-peak all day" : "50% off";
        };
        const next = () => {
          const change = nextPeakChange(now());
          if (!change) return undefined;
          const peak = billingState(change) === "peak";
          return {
            label: peak ? "→ Peak" : "→ Off-peak",
            color: peak ? api.theme.current.warning : api.theme.current.success,
            detail: `${countdown(change, now())} · ${formatChangeTime(change, now())}`
          };
        };
        const calendarNote = () => {
          const status = holidayCalendarStatus(now());
          if (status === "missing") return "holiday calendar outdated";
          if (status === "provisional" && billing() === "holiday") return "holiday dates provisional";
          return undefined;
        };
        return (() => {
          var _el$ = _$createElement("box"),
            _el$2 = _$createElement("box"),
            _el$3 = _$createElement("text"),
            _el$4 = _$createElement("strong"),
            _el$6 = _$createElement("text"),
            _el$7 = _$createElement("box"),
            _el$8 = _$createElement("text"),
            _el$0 = _$createElement("text"),
            _el$1 = _$createElement("box"),
            _el$10 = _$createElement("text"),
            _el$11 = _$createElement("text");
          _$insertNode(_el$, _el$2);
          _$insertNode(_el$, _el$7);
          _$insertNode(_el$, _el$1);
          _$setProp(_el$, "flexDirection", "column");
          _$setProp(_el$, "flexShrink", 0);
          _$insertNode(_el$2, _el$3);
          _$insertNode(_el$2, _el$6);
          _$setProp(_el$2, "flexDirection", "row");
          _$setProp(_el$2, "gap", 1);
          _$setProp(_el$2, "flexShrink", 0);
          _$insertNode(_el$3, _el$4);
          _$insertNode(_el$4, _$createTextNode(`DeepSeek Usage`));
          _$setProp(_el$6, "opacity", 0.7);
          _$setProp(_el$6, "selectable", false);
          _$insert(_el$6, statusText);
          _$insertNode(_el$7, _el$8);
          _$insertNode(_el$7, _el$0);
          _$setProp(_el$7, "flexDirection", "row");
          _$setProp(_el$7, "gap", 1);
          _$setProp(_el$7, "flexShrink", 0);
          _$insertNode(_el$8, _$createTextNode(`DeepSeek`));
          _$setProp(_el$8, "width", 10);
          _$insert(_el$0, balanceText);
          _$insertNode(_el$1, _el$10);
          _$insertNode(_el$1, _el$11);
          _$setProp(_el$1, "flexDirection", "row");
          _$setProp(_el$1, "gap", 1);
          _$setProp(_el$1, "flexShrink", 0);
          _$setProp(_el$10, "width", 10);
          _$insert(_el$10, peakLabel);
          _$insert(_el$11, price);
          _$insert(_el$, () => {
            const change = next();
            if (!change) return null;
            return (() => {
              var _el$12 = _$createElement("box"),
                _el$13 = _$createElement("text"),
                _el$14 = _$createElement("text");
              _$insertNode(_el$12, _el$13);
              _$insertNode(_el$12, _el$14);
              _$setProp(_el$12, "flexDirection", "row");
              _$setProp(_el$12, "gap", 1);
              _$setProp(_el$12, "flexShrink", 0);
              _$setProp(_el$13, "width", 10);
              _$insert(_el$13, () => change.label);
              _$insert(_el$14, () => change.detail);
              _$effect(_p$ => {
                var _v$7 = change.color,
                  _v$8 = api.theme.current.textMuted;
                _v$7 !== _p$.e && (_p$.e = _$setProp(_el$13, "fg", _v$7, _p$.e));
                _v$8 !== _p$.t && (_p$.t = _$setProp(_el$14, "fg", _v$8, _p$.t));
                return _p$;
              }, {
                e: undefined,
                t: undefined
              });
              return _el$12;
            })();
          }, null);
          _$insert(_el$, (() => {
            var _c$ = _$memo(() => !!calendarNote());
            return () => _c$() ? (() => {
              var _el$15 = _$createElement("text");
              _$setProp(_el$15, "opacity", 0.8);
              _$insert(_el$15, calendarNote);
              _$effect(_$p => _$setProp(_el$15, "fg", api.theme.current.warning, _$p));
              return _el$15;
            })() : null;
          })(), null);
          _$effect(_p$ => {
            var _v$ = api.theme.current.text,
              _v$2 = statusColor(),
              _v$3 = api.theme.current.textMuted,
              _v$4 = balanceColor(),
              _v$5 = peakColor(),
              _v$6 = api.theme.current.textMuted;
            _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
            _v$2 !== _p$.t && (_p$.t = _$setProp(_el$6, "fg", _v$2, _p$.t));
            _v$3 !== _p$.a && (_p$.a = _$setProp(_el$8, "fg", _v$3, _p$.a));
            _v$4 !== _p$.o && (_p$.o = _$setProp(_el$0, "fg", _v$4, _p$.o));
            _v$5 !== _p$.i && (_p$.i = _$setProp(_el$10, "fg", _v$5, _p$.i));
            _v$6 !== _p$.n && (_p$.n = _$setProp(_el$11, "fg", _v$6, _p$.n));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined,
            o: undefined,
            i: undefined,
            n: undefined
          });
          return _el$;
        })();
      }
    }
  });
};
export default {
  id: "deepseek-balance",
  tui
};
//# sourceMappingURL=tui.js.map