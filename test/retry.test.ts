import assert from "node:assert/strict"
import test from "node:test"
import { retryDelay } from "../src/retry.ts"

test("network and server failures back off exponentially up to five minutes", () => {
  assert.equal(retryDelay("network", { attempt: 1, random: () => 0 }), 5_000)
  assert.equal(retryDelay("network", { attempt: 2, random: () => 0 }), 10_000)
  assert.equal(retryDelay("network", { attempt: 3, random: () => 0 }), 20_000)
  assert.equal(retryDelay("server", { attempt: 10, random: () => 0 }), 300_000)
})

test("stable failures use a slower retry cadence", () => {
  assert.equal(retryDelay("no-key", { attempt: 1, random: () => 0 }), 60_000)
  assert.equal(retryDelay("insufficient", { attempt: 1, random: () => 0 }), 60_000)
  assert.equal(retryDelay("unauthorized", { attempt: 1, random: () => 0 }), 300_000)
})

test("rate limits honor Retry-After", () => {
  assert.equal(retryDelay("rate-limited", { attempt: 1, retryAfterMs: 90_000, random: () => 0 }), 90_000)
  assert.equal(retryDelay("rate-limited", { attempt: 1, retryAfterMs: 1_000, random: () => 0 }), 60_000)
})

test("jitter is added without exceeding the cap", () => {
  assert.equal(retryDelay("network", { attempt: 1, random: () => 0.5 }), 6_000)
  assert.equal(retryDelay("server", { attempt: 20, random: () => 1 }), 302_000)
})

test("aborted requests are not retried", () => {
  assert.equal(retryDelay("aborted", { attempt: 1 }), 0)
})
