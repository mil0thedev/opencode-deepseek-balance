import assert from "node:assert/strict"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

// Keep this smoke test offline: point the auth lookup at a missing file and
// ignore any DEEPSEEK_API_KEY from the developer environment.
process.env.OPENCODE_AUTH_FILE = join(tmpdir(), "opencode-deepseek-balance-missing-auth.json")
delete process.env.DEEPSEEK_API_KEY

const tuiUrl = new URL("../dist/tui.js", import.meta.url).href
const entryUrl = new URL("../dist/index.js", import.meta.url).href

const tui = (await import(tuiUrl)) as {
  default: {
    id: string
    setup: (context: unknown) => (() => void) | undefined
  }
}

const entry = (await import(entryUrl)) as {
  default: {
    id: string
    setup: (context: unknown) => Promise<(() => void) | undefined>
  }
}

function createTuiContext() {
  const slots: Array<{ append?: string; render: (input: { sessionID: string }) => unknown }> = []
  const events: string[] = []
  let unregistered = 0
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
      store: (key: string, options: { initial: unknown }) => {
        assert.equal(key, "balance")
        return [options.initial, async () => {}]
      },
    },
    data: {
      on: (type: string) => {
        events.push(type)
        return () => {}
      },
    },
    ui: {
      slot: (claim: { append?: string; render: (input: { sessionID: string }) => unknown }) => {
        slots.push(claim)
        return () => {
          unregistered += 1
        }
      },
    },
  }
  return { context, slots, events, unregistered: () => unregistered }
}

test("TUI entrypoint registers the v2 sidebar slot and cleans up", () => {
  const { context, slots, events, unregistered } = createTuiContext()
  const cleanup = tui.default.setup(context)

  assert.equal(tui.default.id, "deepseek-balance")
  assert.equal(typeof cleanup, "function")
  assert.equal(slots.length, 1)
  assert.equal(slots[0].append, "sidebar.footer")
  assert.deepEqual(events, ["session.idle"])

  cleanup?.()
  assert.equal(unregistered(), 1)
})

test("universal entrypoint starts the TUI when the context can render", async () => {
  const { context, slots } = createTuiContext()
  const cleanup = await entry.default.setup(context)

  assert.equal(typeof cleanup, "function")
  assert.equal(slots.length, 1)
  cleanup?.()
})

test("universal entrypoint ignores a server context", async () => {
  // Mirrors the real server context: it has storage but no UI domain and no
  // `store` method, so the plugin must not import the TUI module.
  const serverContext = {
    storage: {
      get: async () => undefined,
      set: async () => {},
      remove: async () => {},
      scan: async () => [],
    },
  }
  assert.equal(await entry.default.setup(serverContext), undefined)
})
