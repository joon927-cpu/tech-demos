"""Load Kronos-small and forecast a single hourly window on CPU."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from market import HORIZON, Candle, future_opens
from score import repair_ohlc

MODEL_ID = "NeoQuasar/Kronos-small"
TOKENIZER_ID = "NeoQuasar/Kronos-Tokenizer-base"
MAX_CONTEXT = 512
SEED = 7

_VENDOR = Path(__file__).resolve().parent / "vendor" / "kronos"


def load_predictor():
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    threads = str(os.cpu_count() or 1)
    os.environ.setdefault("OMP_NUM_THREADS", threads)
    os.environ.setdefault("MKL_NUM_THREADS", threads)

    import torch

    torch.set_num_threads(int(threads))
    sys.path.insert(0, str(_VENDOR))
    from model import Kronos, KronosPredictor, KronosTokenizer

    tokenizer = KronosTokenizer.from_pretrained(TOKENIZER_ID)
    model = Kronos.from_pretrained(MODEL_ID)
    predictor = KronosPredictor(model, tokenizer, device="cpu", max_context=MAX_CONTEXT)
    predictor.model.eval()
    predictor.tokenizer.eval()
    return predictor


def predict_candles(predictor, history: list[Candle], forecast_start: int) -> list[Candle]:
    import pandas as pd
    import torch

    if len(history) != MAX_CONTEXT:
        raise ValueError(f"Kronos-small expects {MAX_CONTEXT} bars, got {len(history)}")
    opens = future_opens(forecast_start, HORIZON)
    frame = pd.DataFrame(
        {
            "open": [bar.open for bar in history],
            "high": [bar.high for bar in history],
            "low": [bar.low for bar in history],
            "close": [bar.close for bar in history],
            "volume": [max(bar.volume, 0.0) for bar in history],
            "amount": [max(bar.amount, 0.0) for bar in history],
        }
    )
    x_timestamp = pd.Series(pd.to_datetime([bar.time for bar in history], unit="s", utc=True))
    y_timestamp = pd.Series(pd.to_datetime(opens, unit="s", utc=True))

    with torch.inference_mode():
        torch.manual_seed(SEED)
        predicted = predictor.predict(
            df=frame,
            x_timestamp=x_timestamp,
            y_timestamp=y_timestamp,
            pred_len=HORIZON,
            T=1.0,
            top_k=0,
            top_p=0.9,
            sample_count=1,
            verbose=False,
        )

    rows = predicted[["open", "high", "low", "close"]].to_numpy()
    if len(rows) != HORIZON:
        raise RuntimeError(f"expected {HORIZON} forecast rows, got {len(rows)}")

    candles: list[Candle] = []
    for stamp, row in zip(opens, rows, strict=True):
        open_, high, low, close = repair_ohlc(row[0], row[1], row[2], row[3])
        candles.append(
            Candle(
                time=stamp,
                open=open_,
                high=high,
                low=low,
                close=close,
                volume=0.0,
                amount=0.0,
            )
        )
    return candles
