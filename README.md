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

DeepSeek Usage reads the balance from DeepSeek's official API and shows the current peak/off-peak billing window in the sidebar. It uses the DeepSeek credentials already configured in OpenCode, refreshes automatically, and never displays your key.

The pricing row follows DeepSeek's UTC billing windows: `01:00–04:00` and `06:00–10:00`, Monday to Friday. Weekends are off-peak; Chinese public holidays are not included yet.

## Preview

```text
Deepseek Usage  0.2.0
DeepSeek        9.98 USD
Off-peak        50% off · 3h 03m
```

The `Peak` / `Off-peak` row shows the current billing window and how long is left until it changes.

## Features

- Live balance from DeepSeek's official `GET /user/balance` endpoint.
- Peak/off-peak billing window with a countdown to the next change.
- Automatic refresh every 60 seconds and after a session goes idle.

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

## Troubleshooting

| Symptom | What to check |
|---|---|
| The block does not appear | Restart OpenCode and confirm the path registered in `tui.json`. |
| `…` | The first balance request is still pending; wait a few seconds. |
| `n/a` | Missing or unreadable key, HTTP error, or network failure. |
| The balance does not update immediately | The normal refresh is every 60 seconds; `session.idle` also requests one. |
| Two identical blocks appear | The plugin is registered in both the global and project `tui.json`; keep it in one scope. |

## Roadmap

This roadmap separates my next goals from ideas suggested by DeepSeek during development. Suggestions are options, not dated commitments.

### My next goals

| Status | Goal | Details |
|---|---|---|
| Next | Estimated session spend (USD) | See how much the current session has spent so far, next to your balance. |
| Planned | Preferred display currency | Show your balance in your preferred currency instead of USD. |

### Suggested by DeepSeek

| Status | Idea | Details |
|---|---|---|
| Explore | Chinese public holiday calendar | Keep the peak/off-peak indicator accurate on holidays. |
| Explore | Configurable refresh interval | Tune the 60-second refresh and 5-second retry. |
| Explore | Balance breakdown | Show `granted_balance` and `topped_up_balance` in addition to the total. |
| Explore | Manual refresh | Add a command palette action to fetch the balance immediately. |
| Explore | Clearer error states | Replace `n/a` with `no key` or `network error`, without exposing the key or the response body. |
| Explore | Show all currencies | Use every entry in `balance_infos` instead of only the first. |
