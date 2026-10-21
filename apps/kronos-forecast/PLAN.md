# kronos-forecast — PLAN

Source: https://x.com/RoundtableSpace/status/2112329196437684311
Model: https://github.com/shiyu-coder/Kronos (MIT) · weights `NeoQuasar/Kronos-small` on Hugging Face

## Goal
Show the last 512 hourly BTC/USDT candles and a Kronos forecast of the next 24, on one candlestick chart, with a one-click backtest against last month.

## MVP (single user, single screen)
- On load, fetch the last 512 **closed** hourly BTC/USDT candles from a public exchange (Binance, then `data-api.binance.vision`, then Kraken, then Coinbase). No API key.
- Run **Kronos-small** (context 512) on CPU and forecast the next 24 hourly candles.
- One candlestick chart: history in green/red, forecast in a separate indigo/violet palette, with a legend.
- **Backtest** button: anchor 30 days before the latest closed hour, forecast 24 hours from the 512 bars before that anchor, overlay the actual closes, and show close MAE plus close-to-close direction accuracy.
- A visible note: "Research toy, not trading advice."

### Out of scope
- Orders, signals, alerts, accounts, or persistence.
- More symbols, intervals, or models in the UI.
- GPU inference, finetuning, or sample-path fans.
- A volume pane.

## Runtime decision
Kronos ships as PyTorch (`KronosPredictor` + a custom hierarchical tokenizer). There is no official ONNX or browser build, and porting the tokenizer and autoregressive sampler would not be a reliable shortcut. The demo runs **Kronos-small on CPU in a small Python service** managed by uv. Kronos-mini is the fallback only if small cannot load or finish a 24-step forecast on this CPU.

## Stack
- Bun; `bunfig.toml` with `[install] minimumReleaseAge = 259200` created before any install.
- `bunx create-vite` React + TypeScript.
- shadcn/ui minimalist preset, which is Lyra (`radix-lyra`: Phosphor, JetBrains Mono, sharp corners). Button, Card, Badge.
- `lightweight-charts` for the candlestick chart.
- Python service in `service/`, started with `uv run` from the Bun `dev` script (concurrently). FastAPI on `127.0.0.1:8787`; Vite proxies `/api`.
- Vendored MIT `model/` package from Kronos (three source files) so inference does not depend on a non-packaged git install. Weights download from Hugging Face on first run.
- `bun install && bun run dev` from `apps/kronos-forecast/` starts the site and the model service.

## Tasks (vertical slices)
1. Scaffold + bunfig + a page that can call `/api/health`.
2. Exchange fetch (with fallbacks) and a chart of real BTC/USDT hourly history.
3. Kronos-small forecast of the next 24 candles, drawn in a distinct style.
4. Backtest on a window from 30 days ago, with MAE and direction accuracy.
5. shadcn polish, disclaimer, README. Screenshot and video for the PR.

## Testing
- Pytest for exchange payload parsers, the hourly window slice, OHLC repair, and MAE / direction accuracy. No UI test scaffolding. Live model and network are checked by running the app.

## Deferred
- Phase 2: symbol and interval picker.
- Phase 3: several sampled paths and an uncertainty band (`sample_count` > 1).
- Phase 4: Kronos-base or GPU when a device is present.
- Phase 5: volume pane and CSV export.
