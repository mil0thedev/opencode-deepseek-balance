# Plugin futures

Working document for `opencode-deepseek-balance`. The vision is to move from a balance widget to a **DeepSeek spend control center**: balance, trend, per-session spend, budget, holidays, and alerts.

- Baseline: `0.3.0`.
- Current release: `0.4.0`.
- Scope of this release: OpenCode V2-only migration, packaging, and docs.
- Product features remain documented and marked as pending.
- Legend: `[x]` implemented, `[ ]` pending.

**Compatibility vision.** The plugin targets OpenCode V2 only. OpenCode 1.x is no longer supported and there is no dual-compatibility window. If a 1.x build is requested, it can be produced from the `0.3.0` tag.

## 1. Implemented fixes

### Billing accuracy

- [x] **Chinese public holidays.** `isPeak` no longer marks peak on a Chinese holiday. DeepSeek treats the whole day as off-peak.
- [x] **Calendar in `Asia/Shanghai`.** The holiday date is derived from the Chinese day, not the UTC day. A Chinese holiday starts at 16:00 UTC on the previous day.
- [x] **Official 2026 calendar.** State Council dates: Jan 1–3, Feb 15–23, Apr 4–6, May 1–5, Jun 19–21, Sep 25–27, Oct 1–7.
- [x] **Provisional 2027 calendar.** Estimated dates are marked provisional until the official calendar is published.
- [x] **`Holiday` state.** The UI distinguishes peak, off-peak, and holiday.
- [x] **Outdated calendar warning.** If there is no data for the current year, the UI shows `holiday calendar outdated`.
- [x] **Provisional date warning.** A provisional holiday renders as `Holiday*`, and `holiday dates provisional` appears while that holiday is active.
- [x] **Wider next-change search.** `nextPeakChange` scans 40 days instead of 8, enough for the Spring Festival and weekends.
- [x] **Countdown with days.** `63h 00m` now renders as `2d 15h`.
- [x] **Local time of the next change.** The pricing row shows the local time; if the change falls on another day, it appends the abbreviated weekday.
- [x] **Accurate clock at the boundary.** The clock still ticks every 30 seconds, but it schedules an exact tick for the next peak/off-peak change.

### State, cache, and errors

- [x] **Last balance persisted.** Balance and timestamp are stored in `context.storage.store`; on startup OpenCode shows it immediately as cached data.
- [x] **Balance survives a network failure.** If a balance was already known, it is kept in a `stale` state together with its age.
- [x] **Version and data age.** The header shows the plugin version; in the `stale` state it appends `cached · 2m ago` or the current error.
- [x] **Typed errors.** `BalanceError` distinguishes `no-key`, `unauthorized`, `insufficient`, `rate-limited`, `network`, `timeout`, `server`, `http`, `invalid-response`, and `aborted`.
- [x] **Clear UI labels.** `no key`, `invalid key`, `insufficient`, `rate limited`, `network error`, `timeout`, `API error`, `bad response`.
- [x] **`insufficient` state.** Uses the API's `is_available` and shows `insufficient` when the balance cannot cover calls.
- [x] **Slower `no-key` retry.** Goes from every 5 seconds to every 60 seconds, without reading the credentials file in a loop.
- [x] **Slower `unauthorized` retry.** Every 5 minutes to avoid hammering the API with an invalid key.
- [x] **Exponential backoff.** Network, timeout, and server failures: 5 s, 10 s, 20 s… up to 5 minutes.
- [x] **Jitter.** Up to 2 seconds added to avoid synchronized bursts.
- [x] **`Retry-After`.** `429` responses honor DeepSeek's header, with a 60-second minimum and a 30-minute maximum.
- [x] **No concurrent refreshes.** An in-flight guard coalesces the timer, `session.idle`, and any other attempt.
- [x] **Cancellation on dispose.** The `AbortController` cancels the in-flight request and state is not updated after dispose.
- [x] **Request timeout.** Five seconds by default, with `timeout` and `aborted` classified separately.
- [x] **Response validation.** `is_available`, `balance_infos`, currency, total balance, and breakdown are validated before the data is accepted.
- [x] **All currencies.** Every `balance_infos` entry is parsed, not just the first. The sidebar shows the first one; the full breakdown is ready for the panel.
- [x] **Breakdown available.** `granted_balance` and `topped_up_balance` are preserved in the model even though they are not shown in the sidebar yet.
- [x] **Currency formatting.** `Intl.NumberFormat` with a symbol and a safe fallback for invalid values or currencies.
- [x] **Cached credentials.** The auth file is read only when its `mtime` or size changes, with a per-path cache.
- [x] **Two auth paths.** Both `$XDG_DATA_HOME/opencode/auth.json` and `$XDG_CONFIG_HOME/opencode/auth.json` are checked.
- [x] **Compatible auth formats.** Legacy object (`deepseek.key`), integration array (`integrationID` + `value`), and registry by ID (`deepseek`, `providerID`, or `id`).
- [x] **Flexible extraction.** Nested `key`, `apiKey`, `token`, `value`, and `credentials` are accepted.
- [x] **Clean environment variables.** `DEEPSEEK_API_KEY` is trimmed and ignored when it is empty.
- [x] **Auth file override.** `OPENCODE_AUTH_FILE` points at another location, useful for tests and custom installs.
- [x] **Documented precedence.** OpenCode auth first; `DEEPSEEK_API_KEY` as a fallback.
- [x] **No key leakage.** Errors contain only the HTTP status and category; tests verify the key never appears in the message.

### UI and copy

- [x] **Correct capitalization.** `Deepseek` → `DeepSeek`.
- [x] **Version in the header.** The plugin version replaces the data age when the balance is fresh.
- [x] **Last update still visible.** In the `stale` state the age stays visible next to the warning.
- [x] **Fixed label column.** Labels share a 10-cell column so every value starts at the same position.
- [x] **Clear pricing copy.** The current row shows `Peak` + `2× rate` or `Off-peak` + `50% off`; the `→` row shows `3h 03m · 21:30`.
- [x] **Visible holiday state.** `Holiday` / `Holiday*`.
- [x] **Semantic colors.** Green for off-peak, yellow for peak, red for errors, gray for stale.
- [x] **Never color-only.** Peak, off-peak, holiday, errors, and age always carry explicit text.

### Packaging and tests

- [x] **Peer dependencies.** `solid-js`, `@opentui/core`, `@opentui/solid`, and `@opencode/plugin` are declared as optional peers with V2 ranges.
- [x] **V2 setup test.** A mock TUI context verifies the `sidebar.footer` claim, the `session.idle` subscription, cleanup, and the no-op server context.
- [x] **Balance tests.** Parsing, multiple currencies, breakdown, `is_available`, invalid JSON, 401, 429, 500, abort, and timeout.
- [x] **Credential tests.** Auth/env precedence, trim, malformed file, and empty values.
- [x] **Holiday tests.** Chinese holidays, China/UTC boundary, official/provisional/missing calendar, and holiday skipping.
- [x] **Countdown tests.** Minutes, hours, days, and weekends.
- [x] **Local time tests.** Same day and following day.
- [x] **Retry tests.** Backoff, caps, jitter, `Retry-After`, and abort.
- [x] **Suite runs on Node 22.** `npm test` uses `--experimental-strip-types` and still works on Node 24.
- [x] **README updated.** New preview, features, calendar, troubleshooting, and a link to this document.
- [x] **README.es updated.** The same information in Spanish.
- [x] **Roadmap document.** This file.

## 2. Pending features for V2

### `/deepseek` control panel

- [ ] Register a palette command and a slash command.
- [ ] Open a dedicated panel or dialog.
- [ ] Show total balance, `is_available`, `granted_balance`, and `topped_up_balance`.
- [ ] Show every currency.
- [ ] Show peak/off-peak state, upcoming changes, and holidays.
- [ ] Show the last update and a safe error detail.
- [ ] Show session and daily spend.
- [ ] Show history, trend, and runway.
- [ ] Show current DeepSeek rates.
- [ ] Show cache hit rate and estimated savings.
- [ ] Add a manual refresh button or command with a spinner and toast.

### Spend and budget

- [ ] Current session spend using `context.data.session.cost`.
- [ ] Aggregated daily spend.
- [ ] Breakdown by model and by peak/off-peak window.
- [ ] Soft per-session budget.
- [ ] Soft daily budget.
- [ ] Warning at 80% and 100% without blocking prompts by default.
- [ ] Mark amounts as estimates when appropriate.
- [ ] Compare OpenCode's estimated cost with DeepSeek's effective price.

### History and forecast

- [ ] Store hourly or daily snapshots.
- [ ] Cap retention at 90 days.
- [ ] Ignore top-ups when computing burn rate.
- [ ] Sparkline for 24 hours, 7 days, and 30 days.
- [ ] Average daily spend.
- [ ] Estimated runway: "about 12 days left".
- [ ] Top-up detection.
- [ ] Export history as CSV or JSON.

### Settings and configuration

- [ ] Configurable refresh interval.
- [ ] Configurable primary currency.
- [ ] Low-balance threshold.
- [ ] Minimum-runway threshold.
- [ ] Compact or expanded mode.
- [ ] Language.
- [ ] Privacy mode.
- [ ] Show or hide session spend.
- [ ] Notifications by type.
- [ ] Persist settings with `context.storage`.
- [ ] Validate and migrate the configuration schema.
- [ ] Document every option in the README.

### Alerts

- [ ] Low balance by absolute threshold.
- [ ] Low balance by estimated runway.
- [ ] Invalid key.
- [ ] API down.
- [ ] Session budget exceeded.
- [ ] Daily budget exceeded.
- [ ] Start of the off-peak window, optional and disabled by default.
- [ ] Cooldown so the same alert is not repeated.
- [ ] A single notification per threshold crossing.
- [ ] Respect terminal focus with `when: "blurred"` or `when: "always"`.

### Privacy and language

- [ ] Privacy mode that hides amounts while keeping the peak/off-peak state.
- [ ] Command to turn privacy mode on and off.
- [ ] Persist privacy mode.
- [ ] EN/ES dictionary for the UI.
- [ ] Locale detection or manual setting.
- [ ] Simplified Chinese as an optional additional language.
- [ ] Localized error and troubleshooting text.

### Currencies

- [ ] Show every currency in the panel.
- [ ] Choose the primary currency.
- [ ] Local formatting with `Intl`.
- [ ] Optional conversion to EUR or another currency.
- [ ] Manual exchange rate via configuration.
- [ ] External exchange-rate provider only with explicit opt-in.
- [ ] Update the privacy promise if an external request is added.

### CLI and agent

- [ ] `npx opencode-deepseek-balance --json` CLI.
- [ ] JSON output with balance, currency, peak/off-peak, next change, and errors.
- [ ] Optional `--watch` mode.
- [ ] Read-only `deepseek_usage` tool for the agent.
- [ ] `/balance` command that answers inside the session.
- [ ] Optional budget note in the agent context.
- [ ] No automatic model routing or prompt blocking by default.

### Other improvements

- [ ] Compact state in `home.footer.status`.
- [ ] A "Configure DeepSeek" action when the key is missing.
- [ ] Top-up link or instructions when the balance is insufficient.
- [ ] Selector for multiple accounts or keys.
- [ ] Account label in the panel.
- [ ] Opt-in plugin update check.
- [ ] Contract test for the published package.

## 3. Architecture and quality

- [x] **Separation of responsibilities.** `balance.ts`, `peak.ts`, `retry.ts`, and `tui.tsx`.
- [x] **Typed errors.** No magic strings in the UI.
- [x] **Testable pure functions.** Parsing, formatting, holidays, countdown, and retry.
- [x] **Dependency injection in tests.** `fetchImpl`, `env`, `authFile`, locale, and timezone.
- [x] **No new runtime dependencies.** Manual validation and native APIs.
- [ ] Extract a `view-model` without JSX so the UI can be tested without rendering.
- [ ] Extract the refresh state machine into its own module.
- [ ] Extract configuration into a module with a schema and migrations.
- [ ] Add lint.
- [ ] Add a format check.
- [ ] Add a minimum coverage gate and report.
- [ ] Add a TUI render test with a mocked API.
- [ ] Add a smoke test against a real OpenCode version.
- [ ] Add release automation with changelog and provenance.
- [ ] Add updated screenshots or GIFs to the README.
- [ ] Add a configuration table to the README.

## 4. OpenCode V2 migration

The plugin targets OpenCode V2 only. It uses `@opencode/plugin@2.x`, OpenTUI `>=0.8.0`, and the V2 TUI context. OpenCode 1.x is no longer supported; the last 1.x-compatible release is `0.3.0`.

**Vision.** V2 is the only supported target. There is no dual-compatibility window and no parallel 1.x branch. If a 1.x build is requested, produce it from the `0.3.0` tag.

- [x] Target OpenCode 2.x only and drop the V1 plugin API.
- [x] Migrate `TuiPluginApi` to `Context` + `Plugin.define`.
- [x] Migrate `api.slots.register` to `context.ui.slot`.
- [x] Migrate `api.event.on` to `context.data.on`.
- [x] Migrate `api.lifecycle.onDispose` to the cleanup returned by `setup`.
- [x] Migrate `api.kv` to `context.storage.store`.
- [x] Migrate `api.theme.current` to `context.theme` semantic tokens.
- [x] Update `engines.opencode`, peer dependencies, and package entrypoints.
- [x] Keep the package loadable from `cli.json` and from `opencode.json`; the server context is a no-op.
- [x] Add a mock-context test for setup, the slot claim, and cleanup.
- [ ] Use `context.data.session.cost` for session spend.
- [ ] Use `session.panel` for the dashboard.
- [ ] Add the agent tool in a server entrypoint if it is implemented.
- [ ] Register commands with `context.keymap.layer` when the `/deepseek` panel lands.

## 5. Indicative roadmap

| Version | Theme | Content |
|---|---|---|
| `0.3` | Trust | Holidays, countdown, local time, typed errors, cache, timeout, backoff, peers, and tests |
| `0.4` | OpenCode V2 | V2-only migration: plugin API, packaging, storage, docs, and tests |
| `0.5` | Control | `/deepseek` panel, manual refresh, settings, session spend, and alerts |
| `0.6` | Insights | History, sparkline, runway, cache hit rate, currencies, privacy, and i18n |
| `1.0` | Stability | Documentation, coverage, release automation, and validated configuration |

## 6. Technical decisions

### Holiday calendar

- 2026 source: the official Chinese State Council calendar.
- 2027 source: provisional calendar; it must be replaced when the official one is published.
- DeepSeek treats weekends and full Chinese holidays as off-peak, so make-up working Saturdays are not modeled.
- The date is computed in `Asia/Shanghai` with a fixed +08:00 offset; China has no daylight saving time.
- If the current year is missing, the UI warns and the plugin keeps working with Monday-to-Friday logic.

### Credentials

- Precedence: data `auth.json` → config `auth.json` → `DEEPSEEK_API_KEY`.
- The file is cached by path, `mtime`, and size.
- The legacy format and the OpenCode V2 integration formats are accepted.
- `OPENCODE_AUTH_FILE` overrides the path.
- The key is never included in logs, errors, or rendering.

### Balance cache

- Key: `balance`, scoped by the plugin id in `context.storage`.
- Stores `{ cache: { balance, updatedAt } }`.
- An invalid or older-version cache is ignored.
- A cache write failure does not hide a valid balance.

### Retry policy

| Error | Interval |
|---|---|
| `no-key` | 60 s |
| `unauthorized` | 5 min |
| `insufficient` | 60 s |
| `rate-limited` | `Retry-After` or 60 s, maximum 30 min |
| `network`, `timeout`, `server` | 5 s, 10 s, 20 s… up to 5 min |
| `invalid-response`, `http` | 30 s, 60 s, 120 s… up to 5 min |
| `aborted` | No retry |

Jitter of up to 2 seconds is added.

## 7. Verification

Commands used:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Result for this release:

- [x] `npm run typecheck` with no errors.
- [x] `npm test` with 39 passing tests.
- [x] `npm run build` compiles the six files in `src`.
- [x] Full `npm run check` on local Node 24.
- [x] `npm pack --dry-run` reviewed.
- [ ] CI green on GitHub Actions.
- [ ] Manual test in OpenCode with a real key.

## 8. How to update the calendar

1. Open `src/peak.ts`.
2. Locate `HOLIDAYS`.
3. Replace the provisional year with the official dates.
4. Remove `provisional: true` from confirmed dates.
5. Add the next year when it is published.
6. Update the `test/peak.test.ts` tests if a holiday used in assertions changes.
7. Run `npm run check`.

## 9. Out of scope for now

- Automatically switching models based on balance or time window.
- Blocking prompts by budget without an explicit user decision.
- Making third-party requests by default (holidays, exchange rates, versions).
- Showing the full breakdown in the narrow sidebar; it belongs in the panel.
- Sending the key to any host other than `api.deepseek.com`.

## 10. V2 definition of done

- [ ] `/deepseek` panel with balance, breakdown, spend, and next change.
- [ ] Manual refresh and persistent settings.
- [ ] Session spend and a soft budget.
- [ ] History with trend and runway.
- [ ] Configurable low-balance alerts.
- [ ] Privacy mode.
- [ ] UI in English and Spanish.
- [ ] Official holidays for the current year.
- [ ] UI and integration tests.
- [ ] README with configuration and updated screenshots.
- [x] OpenCode 1.x support removed.
- [ ] OpenCode 2.x verified end to end in a real terminal.
