import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  engines?: Record<string, string>
  exports?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

test("package targets OpenCode v2 only", () => {
  assert.match(pkg.engines?.opencode ?? "", /^>=?2\./)
  assert.equal(pkg.peerDependencies?.["@opencode-ai/plugin"], undefined)
  assert.equal(pkg.devDependencies?.["@opencode-ai/plugin"], undefined)
  assert.match(pkg.peerDependencies?.["@opencode/plugin"] ?? "", /2\./)
})

test("package exposes the TUI and universal entrypoints", () => {
  assert.equal(pkg.exports?.["."], "./dist/index.js")
  assert.equal(pkg.exports?.["./tui"], "./dist/tui.js")
})

test("TUI source imports the v2 plugin API", () => {
  const source = readFileSync(new URL("../src/tui.tsx", import.meta.url), "utf8")
  assert.equal(source.includes("@opencode-ai/plugin"), false)
  assert.match(source, /@opencode\/plugin\/tui/)
})
