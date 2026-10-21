"""Forecast scoring and candlestick repair. No torch import."""

from __future__ import annotations

import math


def repair_ohlc(open_: float, high: float, low: float, close: float) -> tuple[float, float, float, float]:
    values = (float(open_), float(high), float(low), float(close))
    if not all(math.isfinite(value) for value in values):
        raise ValueError("forecast price is not finite")
    if min(values) <= 0:
        raise ValueError("forecast price is not positive")
    open_price, high_price, low_price, close_price = values
    return (
        open_price,
        max(high_price, open_price, close_price),
        min(low_price, open_price, close_price),
        close_price,
    )


def mae(predicted: list[float], actual: list[float]) -> float:
    if len(predicted) != len(actual) or not predicted:
        raise ValueError("predicted and actual closes must be the same non-empty length")
    return sum(abs(left - right) for left, right in zip(predicted, actual, strict=True)) / len(predicted)


def direction_accuracy(predicted: list[float], actual: list[float], previous: float) -> float:
    """Share of bars whose close-to-close sign matches, including the step off `previous`."""
    if len(predicted) != len(actual) or not predicted:
        raise ValueError("predicted and actual closes must be the same non-empty length")
    hits = 0
    prev_pred = previous
    prev_actual = previous
    for pred, real in zip(predicted, actual, strict=True):
        if _sign(pred - prev_pred) == _sign(real - prev_actual):
            hits += 1
        prev_pred = pred
        prev_actual = real
    return hits / len(predicted)


def _sign(value: float) -> int:
    if value > 0:
        return 1
    if value < 0:
        return -1
    return 0
