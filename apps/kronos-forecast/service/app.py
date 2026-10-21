"""HTTP API for a live 24-hour forecast and a one-window backtest."""

from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from engine import MODEL_ID, load_predictor, predict_candles
from market import (
    DISPLAY,
    Candle,
    backtest_bounds,
    fetch_range,
    live_bounds,
)
from score import direction_accuracy, mae

log = logging.getLogger("uvicorn.error")

_lock = threading.Lock()
_state: dict[str, object] = {
    "ready": False,
    "error": None,
    "predictor": None,
}


def _load() -> None:
    try:
        log.info("loading %s on cpu", MODEL_ID)
        started = time.perf_counter()
        _state["predictor"] = load_predictor()
        _state["ready"] = True
        log.info("model ready in %.1fs", time.perf_counter() - started)
    except Exception as exc:
        _state["error"] = str(exc)
        log.exception("model load failed")


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    thread = threading.Thread(target=_load, name="kronos-load", daemon=True)
    thread.start()
    yield


app = FastAPI(title="Kronos forecast", lifespan=_lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {
        "ready": bool(_state["ready"]),
        "model": MODEL_ID,
        "device": "cpu",
        "error": _state["error"],
    }


@app.post("/api/forecast")
def forecast() -> dict[str, object]:
    return _run("forecast")


@app.post("/api/backtest")
def backtest() -> dict[str, object]:
    return _run("backtest")


def _run(mode: str) -> dict[str, object]:
    if _state["error"]:
        raise HTTPException(status_code=503, detail=str(_state["error"]))
    if not _state["ready"]:
        raise HTTPException(status_code=503, detail="Kronos-small is still loading")
    if not _lock.acquire(timeout=300):
        raise HTTPException(status_code=503, detail="another forecast is still running")
    started = time.perf_counter()
    try:
        now = int(time.time())
        if mode == "forecast":
            hist_start, forecast_start, _forecast_end = live_bounds(now)
            series = fetch_range(hist_start, forecast_start)
            history = series.candles
            actual: list[Candle] | None = None
        elif mode == "backtest":
            hist_start, forecast_start, forecast_end = backtest_bounds(now)
            series = fetch_range(hist_start, forecast_end)
            history = [bar for bar in series.candles if bar.time < forecast_start]
            actual = [bar for bar in series.candles if bar.time >= forecast_start]
            if len(actual) != 24:
                raise HTTPException(status_code=502, detail="backtest window did not include 24 actual bars")
        else:
            raise HTTPException(status_code=400, detail="unknown mode")

        if len(history) != 512:
            raise HTTPException(status_code=502, detail=f"expected 512 history bars, got {len(history)}")

        log.info("%s via %s anchor %s", mode, series.source, forecast_start)
        predicted = predict_candles(_state["predictor"], history, forecast_start)
        metrics = None
        if actual is not None:
            pred_close = [bar.close for bar in predicted]
            actual_close = [bar.close for bar in actual]
            error = mae(pred_close, actual_close)
            mean_close = sum(actual_close) / len(actual_close)
            metrics = {
                "mae": round(error, 2),
                "maePct": round(error / mean_close * 100, 3),
                "directionAccuracy": round(
                    direction_accuracy(pred_close, actual_close, history[-1].close),
                    4,
                ),
            }
        return {
            "mode": mode,
            "symbol": series.symbol,
            "interval": "1h",
            "source": series.source,
            "model": MODEL_ID,
            "device": "cpu",
            "context": len(history),
            "horizon": len(predicted),
            "anchor": datetime.fromtimestamp(forecast_start, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "history": [bar.as_price() for bar in history[-DISPLAY:]],
            "forecast": [bar.as_price() for bar in predicted],
            "actual": None if actual is None else [bar.as_price() for bar in actual],
            "metrics": metrics,
            "elapsedMs": int((time.perf_counter() - started) * 1000),
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("%s failed", mode)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        _lock.release()
