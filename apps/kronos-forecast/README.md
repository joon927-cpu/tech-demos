# Kronos forecast

Hourly BTC/USDT forecast from [Kronos-small](https://huggingface.co/NeoQuasar/Kronos-small), on one candlestick chart. Research toy, not trading advice.

Kronos ([shiyu-coder/Kronos](https://github.com/shiyu-coder/Kronos), MIT) is a PyTorch model with a custom tokenizer. There is no official browser build, so this demo runs it on CPU in a small Python service. `bun run dev` starts both.

## Setup

Install [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/).

```bash
cd apps/kronos-forecast
bun install
bun run dev
```

Open http://127.0.0.1:5173.

The first launch installs the CPU PyTorch stack (uv) and downloads Kronos-small plus its tokenizer from Hugging Face, about 115MB of weights. Later launches reuse the cache.

Forecast loads the last 512 closed hourly candles (Binance, then the Binance vision mirror, then Kraken, then Coinbase — no API key) and predicts the next 24. The chart shows the latest 120 bars of that history in green and red, and the forecast in indigo and violet.

Backtest repeats the forecast on a window from 30 days ago and scores it against the candles that actually printed: close MAE, and close-to-close direction accuracy. Sampling is seeded so the same window repeats.

```bash
bun run test
```

That runs the Python tests for exchange parsers and the error scores. It does not download the model.
