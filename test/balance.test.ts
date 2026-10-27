import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
  BalanceError,
  fetchBalance,
  formatMoney,
  isBalanceCache,
  parseBalance,
  resolveApiKey,
  type Balance,
} from "../src/balance.ts"

function tempAuth(content: string): { dir: string; authFile: string } {
  const dir = mkdtempSync(join(tmpdir(), "opencode-deepseek-balance-"))
  const authFile = join(dir, "auth.json")
  writeFileSync(authFile, content)
  return { dir, authFile }
}

test("parseBalance accepts multiple currencies and the full breakdown", () => {
  const balance = parseBalance({
    is_available: true,
    balance_infos: [
      {
        currency: "USD",
        total_balance: "9.98",
        granted_balance: "1.00",
        topped_up_balance: "8.98",
      },
      {
        currency: "CNY",
        total_balance: "72.00",
        granted_balance: "0.00",
        topped_up_balance: "72.00",
      },
    ],
  })

  assert.deepEqual(balance, {
    isAvailable: true,
    entries: [
      { currency: "USD", total: "9.98", granted: "1.00", toppedUp: "8.98" },
      { currency: "CNY", total: "72.00", granted: "0.00", toppedUp: "72.00" },
    ],
  })
})

test("parseBalance rejects incomplete or malformed responses", () => {
  assert.equal(parseBalance(undefined), undefined)
  assert.equal(parseBalance({ balance_infos: [] }), undefined)
  assert.equal(parseBalance({ is_available: true, balance_infos: [] }), undefined)
  assert.equal(
    parseBalance({ is_available: true, balance_infos: [{ currency: "USD" }] }),
    undefined,
  )
  assert.equal(
    parseBalance({ is_available: "yes", balance_infos: [{ currency: "USD", total_balance: "1" }] }),
    undefined,
  )
})

test("parseBalance fills optional breakdown fields with zero", () => {
  assert.deepEqual(
    parseBalance({
      is_available: false,
      balance_infos: [{ currency: "USD", total_balance: "0.00" }],
    }),
    {
      isAvailable: false,
      entries: [{ currency: "USD", total: "0.00", granted: "0", toppedUp: "0" }],
    },
  )
})

test("isBalanceCache validates cached state", () => {
  const balance: Balance = {
    isAvailable: true,
    entries: [{ currency: "USD", total: "9.98", granted: "0", toppedUp: "9.98" }],
  }
  assert.equal(isBalanceCache({ balance, updatedAt: Date.now() }), true)
  assert.equal(isBalanceCache({ balance, updatedAt: "yesterday" }), false)
  assert.equal(isBalanceCache({ balance: { ...balance, entries: [] }, updatedAt: 1 }), false)
  assert.equal(isBalanceCache(undefined), false)
})

test("formatMoney uses the currency symbol and falls back safely", () => {
  assert.equal(formatMoney("9.98", "USD", "en-US"), "$9.98")
  assert.equal(formatMoney("9.98", "CNY", "en-US"), "¥9.98")
  assert.equal(formatMoney("not-a-number", "USD", "en-US"), "not-a-number USD")
  assert.equal(formatMoney("9.98", "NOT_A_CURRENCY", "en-US"), "9.98 NOT_A_CURRENCY")
})

test("resolveApiKey prefers the OpenCode auth file over the environment", (t) => {
  const { dir, authFile } = tempAuth(JSON.stringify({ deepseek: { key: " auth-key " } }))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  assert.deepEqual(
    resolveApiKey({ authFile, env: { DEEPSEEK_API_KEY: "env-key" } }),
    { key: "auth-key", source: "auth" },
  )
})

test("resolveApiKey falls back to a trimmed environment variable", (t) => {
  const { dir, authFile } = tempAuth(JSON.stringify({ deepseek: {} }))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  assert.deepEqual(
    resolveApiKey({ authFile, env: { DEEPSEEK_API_KEY: "  env-key\n" } }),
    { key: "env-key", source: "env" },
  )
})

test("resolveApiKey tolerates a malformed auth file and empty environment values", (t) => {
  const { dir, authFile } = tempAuth("{not-json")
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  assert.equal(resolveApiKey({ authFile, env: { DEEPSEEK_API_KEY: "   " } }), undefined)
})

test("resolveApiKey reads array-shaped OpenCode auth files", (t) => {
  const { dir, authFile } = tempAuth(
    JSON.stringify([{ integrationID: "deepseek", value: { type: "api", key: "array-key" } }]),
  )
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  assert.deepEqual(resolveApiKey({ authFile, env: {} }), { key: "array-key", source: "auth" })
})

test("resolveApiKey reads integration records and skips unrelated entries", (t) => {
  const { dir, authFile } = tempAuth(
    JSON.stringify({
      github: { key: "github-key" },
      deepseek: { credentials: { token: "record-key" } },
    }),
  )
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  assert.deepEqual(resolveApiKey({ authFile, env: {} }), { key: "record-key", source: "auth" })
})

test("resolveApiKey checks multiple auth paths in order", (t) => {
  const first = tempAuth(JSON.stringify({ deepseek: {} }))
  const second = tempAuth(JSON.stringify({ deepseek: { apiKey: "second-key" } }))
  t.after(() => {
    rmSync(first.dir, { recursive: true, force: true })
    rmSync(second.dir, { recursive: true, force: true })
  })

  assert.deepEqual(
    resolveApiKey({
      authFiles: [first.authFile, second.authFile],
      env: { DEEPSEEK_API_KEY: "env-key" },
    }),
    { key: "second-key", source: "auth" },
  )
})

test("fetchBalance parses a successful response", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        is_available: true,
        balance_infos: [
          {
            currency: "USD",
            total_balance: "9.98",
            granted_balance: "1.00",
            topped_up_balance: "8.98",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )

  const balance = await fetchBalance("secret", { fetchImpl, timeoutMs: 100 })
  assert.equal(balance.isAvailable, true)
  assert.deepEqual(balance.entries[0], {
    currency: "USD",
    total: "9.98",
    granted: "1.00",
    toppedUp: "8.98",
  })
})

test("fetchBalance maps HTTP errors without exposing the key", async () => {
  const unauthorized: typeof fetch = async () => new Response("", { status: 401 })
  await assert.rejects(fetchBalance("secret", { fetchImpl: unauthorized, timeoutMs: 100 }), (error) => {
    assert.ok(error instanceof BalanceError)
    assert.equal(error.kind, "unauthorized")
    assert.equal(error.message.includes("secret"), false)
    return true
  })

  const rateLimited: typeof fetch = async () =>
    new Response("", { status: 429, headers: { "retry-after": "3" } })
  await assert.rejects(
    fetchBalance("secret", { fetchImpl: rateLimited, timeoutMs: 100 }),
    (error) => {
      assert.ok(error instanceof BalanceError)
      assert.equal(error.kind, "rate-limited")
      assert.equal(error.retryAfterMs, 3_000)
      return true
    },
  )

  const insufficient: typeof fetch = async () => new Response("", { status: 402 })
  await assert.rejects(
    fetchBalance("secret", { fetchImpl: insufficient, timeoutMs: 100 }),
    (error) => {
      assert.ok(error instanceof BalanceError)
      assert.equal(error.kind, "insufficient")
      return true
    },
  )

  const server: typeof fetch = async () => new Response("", { status: 503 })
  await assert.rejects(fetchBalance("secret", { fetchImpl: server, timeoutMs: 100 }), (error) => {
    assert.ok(error instanceof BalanceError)
    assert.equal(error.kind, "server")
    assert.equal(error.status, 503)
    return true
  })
})

test("fetchBalance rejects invalid JSON and unexpected payloads", async () => {
  const invalidJson: typeof fetch = async () =>
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })
  await assert.rejects(
    fetchBalance("secret", { fetchImpl: invalidJson, timeoutMs: 100 }),
    (error) => {
      assert.ok(error instanceof BalanceError)
      assert.equal(error.kind, "invalid-response")
      return true
    },
  )

  const invalidShape: typeof fetch = async () =>
    new Response(JSON.stringify({ is_available: true, balance_infos: [] }), { status: 200 })
  await assert.rejects(
    fetchBalance("secret", { fetchImpl: invalidShape, timeoutMs: 100 }),
    (error) => {
      assert.ok(error instanceof BalanceError)
      assert.equal(error.kind, "invalid-response")
      return true
    },
  )
})

test("fetchBalance handles pre-aborted signals and timeouts", async () => {
  const controller = new AbortController()
  controller.abort()
  const unused: typeof fetch = async () => new Response("", { status: 200 })
  await assert.rejects(
    fetchBalance("secret", { fetchImpl: unused, signal: controller.signal, timeoutMs: 100 }),
    (error) => {
      assert.ok(error instanceof BalanceError)
      assert.equal(error.kind, "aborted")
      return true
    },
  )

  const hanging: typeof fetch = (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"))
      })
    })
  await assert.rejects(
    fetchBalance("secret", { fetchImpl: hanging, timeoutMs: 10 }),
    (error) => {
      assert.ok(error instanceof BalanceError)
      assert.equal(error.kind, "timeout")
      return true
    },
  )
})
