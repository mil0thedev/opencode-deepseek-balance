<p align="right">
  <a href="README.es.md">Español</a> | <strong>English</strong>
</p>

<p align="center">
  <img src="assets/banner.en.webp" alt="opencode-deepseek-balance: DeepSeek balance and peak/off-peak pricing in the OpenCode sidebar" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square"></a>
  <a href="https://opencode.ai"><img alt="OpenCode >= 1.19" src="https://img.shields.io/badge/opencode-%E2%89%A51.19-111111?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/opencode-deepseek-balance"><img alt="npm" src="https://img.shields.io/npm/v/opencode-deepseek-balance?style=flat-square"></a>
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,solidjs,bun,babel,npm" alt="TypeScript, SolidJS, Bun, Babel, npm">
</p>

Monitor your remaining DeepSeek balance and check peak hours, right from the OpenCode sidebar.

DeepSeek Usage reads the balance from DeepSeek's official API and shows the current peak/off-peak billing window in the sidebar. It uses the DeepSeek credentials already configured in OpenCode, refreshes automatically, keeps the last known balance while offline, and never displays your key.

The pricing row follows DeepSeek's UTC billing windows: `01:00–04:00` and `06:00–10:00`, Monday to Friday. Weekends and Chinese public holidays are off-peak. The bundled calendar contains the official 2026 dates and provisional 2027 dates; provisional holidays are marked with `*`, and the plugin warns when the calendar has no data for the current year.

## Preview

```text
DeepSeek Usage 0.3.0
DeepSeek   $9.98
Off-peak   50% off
→ Peak     3h 03m · 21:30
```

The `Peak` / `Off-peak` / `Holiday` row shows the current billing window and its rate. The `→` row shows the next window, how long is left until it changes, and the local time of that change in 24-hour format.

## Features

- Live balance from DeepSeek's official `GET /user/balance` endpoint.
- Peak/off-peak billing window with a countdown to the next change.
- Chinese public holiday calendar: official 2026 dates and provisional 2027 dates.
- Last known balance persisted and shown while refreshing or offline, with its age.
- Clear error states: `no key`, `invalid key`, `insufficient`, `rate limited`, `network error`, `timeout`, `API error`, `bad response`.
- Five-second request timeout, abort on plugin disposal, and one in-flight request at a time.
- Exponential backoff with jitter for transient failures and `Retry-After` support for rate limits.
- Automatic refresh every 60 seconds and after a session goes idle.
- All `balance_infos` entries are parsed; the sidebar shows the first one and the full breakdown is ready for the dashboard work in [`FUTURES.md`](FUTURES.md).

## Install

```bash
opencode plugin opencode-deepseek-balance
```

Add `-g` to use the global config instead of the current project. Restart OpenCode after the command updates `tui.json`.

> [!TIP]
> The process is the same on macOS, Linux, and Windows.

Make sure DeepSeek is already configured in OpenCode (`opencode auth login`) or export `DEEPSEEK_API_KEY` before starting OpenCode.

> [!IMPORTANT]
> Your API key stays local. The plugin sends it only to `api.deepseek.com` over HTTPS, never logs or displays it, and makes no third-party requests.

## Holiday calendar

DeepSeek bills Chinese public holidays as off-peak for the whole day. The plugin checks the holiday date in `Asia/Shanghai`, because a Chinese calendar day starts at 16:00 UTC of the previous day.

- 2026: official State Council dates.
- 2027: provisional dates until the State Council publishes the official calendar. Holidays from this year are shown as `Holiday*`.
- 2028 and later: the sidebar shows `holiday calendar outdated` until the plugin is updated.

If the calendar warning appears, update the plugin to get the latest dates. The full calendar lives in `src/peak.ts`.

## Troubleshooting

| Symptom | What to check |
|---|---|
| The block does not appear | Restart OpenCode and confirm the path registered in `tui.json`. |
| `checking…` | The first balance request is still pending; wait a few seconds. |
| `no key` | DeepSeek is not configured in OpenCode and `DEEPSEEK_API_KEY` is not set. |
| `invalid key` | The saved key was rejected. Run `opencode auth login` again or replace `DEEPSEEK_API_KEY`. |
| `insufficient` | DeepSeek reports that the balance cannot cover API calls. Top up your account. |
| `network error`, `timeout`, `API error` | Temporary connectivity or server issue. The plugin retries with backoff. |
| `rate limited` | DeepSeek returned `429`; the plugin respects `Retry-After` and retries later. |
| `bad response` | The API returned JSON the plugin does not understand. Update the plugin. |
| The status shows `cached · …` or an old age | The last known balance is being shown while a refresh fails. Check the connection. |
| `Holiday*` or `holiday dates provisional` | The 2027 calendar is provisional; update the plugin after the official schedule is published. |
| `holiday calendar outdated` | The calendar has no data for the current year. Update the plugin. |
| The balance does not update immediately | The normal refresh is every 60 seconds; `session.idle` also requests one. |
| Two identical blocks appear | The plugin is registered in both the global and project `tui.json`; keep it in one scope. |

## Roadmap

The full V2 checklist — fixes already implemented, features under consideration, architecture work, and the OpenCode V2 migration — is in [`FUTURES.md`](FUTURES.md).

Next goals:

| Status | Goal | Details |
|---|---|---|
| Next | Estimated session spend (USD) | See how much the current session has spent so far, next to your balance. |
| Planned | Preferred display currency | Show your balance in your preferred currency instead of the first API entry. |
| Explore | Dashboard and history | Balance breakdown, spend trend, runway, and peak/off-peak calendar in a dedicated panel. |
