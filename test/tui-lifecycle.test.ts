import assert from "node:assert/strict"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

process.env.OPENCODE_AUTH_FILE = join(tmpdir(), "opencode-deepseek-balance-lifecycle-auth.json")
process.env.DEEPSEEK_API_KEY = "sk-probe-not-a-real-key"

const tuiUrl = new URL("../dist/tui.js", import.meta.url).href
const plugin = (await import(tuiUrl)) as {
  default: { id: string; setup: (context: unknown) => (() => void) | undefined }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const okBody = JSON.stringify({
  is_available: true,
  balance_infos: [
    { currency: "USD", total_balance: "9.98", granted_balance: "0.00", topped_up_balance: "9.98" },
  ],
})

function createContext(state: { cache: unknown }) {
  const handlers: Record<string, () => void> = {}
  const writes: string[] = []
  const context = {
    theme: {
      text: {
        base: "#ffffff",
        muted: "#999999",
        feedback: {
          error: { base: "#ff0000" },
          warning: { base: "#ffff00" },
          success: { base: "#00ff00" },
          info: { base: "#0000ff" },
        },
      },
    },
    storage: {
      store: () => [
        state,
        async (mutate: (draft: { cache: unknown }) => void) => {
          mutate(state)
          writes.push(JSON.stringify(state))
        },
      ],
    },
    data: {
      on: (type: string, handler: () => void) => {
        handlers[type] = handler
        return () => {
          delete handlers[type]
        }
      },
    },
    ui: { slot: () => () => {} },
  }
  return { context, handlers, writes }
}

test("refreshes on start and session.idle and caches without the key", async () => {
  const realFetch = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url))
    return new Response(okBody, { status: 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch
  try {
    const state = { cache: null as unknown }
    const { context, handlers, writes } = createContext(state)
    const cleanup = plugin.default.setup(context)

    await sleep(100)
    assert.deepEqual(urls, ["https://api.deepseek.com/user/balance"])
    assert.equal(writes.length, 1)
    assert.equal(writes[0].includes("sk-probe"), false)

    handlers["session.idle"]?.()
    await sleep(100)
    assert.equal(urls.length, 2)

    cleanup?.()
    assert.equal(handlers["session.idle"], undefined)
  } finally {
    globalThis.fetch = realFetch
  }
})

test("disposing the widget aborts the in-flight balance request", async () => {
  const realFetch = globalThis.fetch
  let signal: AbortSignal | undefined
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    signal = init?.signal ?? undefined
    return new Promise<Response>(() => {})
  }) as typeof fetch
  try {
    const { context } = createContext({ cache: null })
    const cleanup = plugin.default.setup(context)

    await sleep(50)
    assert.ok(signal)
    assert.equal(signal.aborted, false)

    cleanup?.()
    assert.equal(signal.aborted, true)
  } finally {
    globalThis.fetch = realFetch
  }
})
