"""Public hourly BTC candles. No API key.

Binance's main host is geo-blocked in some regions, so the client tries
api.binance.com, then data-api.binance.vision, then Kraken, then Coinbase.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

HOUR = 3600
LOOKBACK = 512
HORIZON = 24
DISPLAY = 120
BACKTEST_DAYS = 30
USER_AGENT = "kronos-forecast/0.1 (research toy)"

BINANCE_HOSTS = (
    "https://api.binance.com",
    "https://data-api.binance.vision",
)


class ExchangeError(Exception):
    pass


@dataclass(frozen=True)
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float

    def as_price(self) -> dict[str, float | int]:
        return {
            "time": self.time,
            "open": round(self.open, 2),
            "high": round(self.high, 2),
            "low": round(self.low, 2),
            "close": round(self.close, 2),
        }


@dataclass(frozen=True)
class Series:
    candles: list[Candle]
    source: str
    symbol: str


def last_closed_open(now: int) -> int:
    """Open time of the last fully closed hourly bar."""
    return (now // HOUR) * HOUR - HOUR


def live_bounds(now: int) -> tuple[int, int, int]:
    """History start, forecast start, and exclusive forecast end for a live run."""
    forecast_start = last_closed_open(now) + HOUR
    return forecast_start - LOOKBACK * HOUR, forecast_start, forecast_start + HORIZON * HOUR


def backtest_bounds(now: int, days: int = BACKTEST_DAYS) -> tuple[int, int, int]:
    """Same shape as live_bounds, anchored `days` before the latest closed hour."""
    forecast_start = last_closed_open(now) - days * 24 * HOUR
    return forecast_start - LOOKBACK * HOUR, forecast_start, forecast_start + HORIZON * HOUR


def future_opens(forecast_start: int, horizon: int = HORIZON) -> list[int]:
    return [forecast_start + i * HOUR for i in range(horizon)]


def require_hourly(candles: Sequence[Candle], start: int, end: int) -> list[Candle]:
    """Keep bars whose open time is in [start, end) and require an exact hourly grid."""
    by_time = {candle.time: candle for candle in candles if start <= candle.time < end}
    expected = list(range(start, end, HOUR))
    ordered = [by_time[stamp] for stamp in expected if stamp in by_time]
    if [candle.time for candle in ordered] != expected:
        missing = len(expected) - len(ordered)
        raise ExchangeError(f"hourly series is missing {missing} bars")
    return ordered


def parse_binance_klines(rows: Sequence[Sequence[Any]]) -> list[Candle]:
    candles: list[Candle] = []
    for row in rows:
        candles.append(
            Candle(
                time=int(row[0]) // 1000,
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[5]),
                amount=float(row[7]),
            )
        )
    return candles


def parse_kraken_ohlc(rows: Sequence[Sequence[Any]]) -> list[Candle]:
    candles: list[Candle] = []
    for row in rows:
        volume = float(row[6])
        vwap = float(row[5])
        candles.append(
            Candle(
                time=int(row[0]),
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=volume,
                amount=volume * vwap,
            )
        )
    return candles


def parse_coinbase_candles(rows: Sequence[Sequence[Any]]) -> list[Candle]:
    # [time, low, high, open, close, volume], newest first.
    candles: list[Candle] = []
    for row in rows:
        close = float(row[4])
        volume = float(row[5])
        candles.append(
            Candle(
                time=int(row[0]),
                open=float(row[3]),
                high=float(row[2]),
                low=float(row[1]),
                close=close,
                volume=volume,
                amount=volume * close,
            )
        )
    return candles


def get_json(url: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        raise ExchangeError(f"HTTP {exc.code} from {url}") from exc
    except urllib.error.URLError as exc:
        raise ExchangeError(f"{url} failed: {exc.reason}") from exc
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ExchangeError(f"non-JSON response from {url}") from exc


def _binance(host: str, start: int, end: int) -> list[Candle]:
    cursor = start * 1000
    end_ms = end * 1000
    rows: list[Any] = []
    for _ in range(8):
        if cursor >= end_ms:
            break
        url = (
            f"{host}/api/v3/klines?symbol=BTCUSDT&interval=1h"
            f"&startTime={cursor}&endTime={end_ms - 1}&limit=1000"
        )
        payload = get_json(url)
        if isinstance(payload, dict):
            raise ExchangeError(f"{host}: {payload.get('msg', payload)}")
        if not payload:
            break
        rows.extend(payload)
        nxt = int(payload[-1][0]) + HOUR * 1000
        if nxt <= cursor:
            break
        cursor = nxt
        if len(payload) < 1000:
            break
    return parse_binance_klines(rows)


def _kraken(start: int, end: int) -> list[Candle]:
    since = start
    rows: list[Any] = []
    for _ in range(8):
        payload = get_json(
            f"https://api.kraken.com/0/public/OHLC?pair=XBTUSDT&interval=60&since={since}"
        )
        errors = payload.get("error") or []
        if errors:
            raise ExchangeError(f"Kraken: {errors}")
        result = payload["result"]
        page = next(value for key, value in result.items() if key != "last")
        rows.extend(page)
        last = int(result["last"])
        if not page or last <= since or int(page[-1][0]) + HOUR >= end:
            break
        since = last
    return parse_kraken_ohlc(rows)


def _iso(stamp: int) -> str:
    return datetime.fromtimestamp(stamp, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _coinbase(product: str, start: int, end: int) -> list[Candle]:
    rows: list[Any] = []
    cursor = start
    for _ in range(12):
        if cursor >= end:
            break
        chunk_end = min(end, cursor + 300 * HOUR)
        url = (
            "https://api.exchange.coinbase.com/products/"
            f"{product}/candles?granularity=3600&start={_iso(cursor)}&end={_iso(chunk_end)}"
        )
        payload = get_json(url)
        if isinstance(payload, dict):
            raise ExchangeError(f"Coinbase {product}: {payload.get('message', payload)}")
        rows.extend(payload)
        cursor = chunk_end
    return parse_coinbase_candles(rows)


def first_ok(attempts: Sequence[tuple[str, str, Callable[[], list[Candle]]]], start: int, end: int) -> Series:
    errors: list[str] = []
    for source, symbol, fetch in attempts:
        try:
            candles = require_hourly(fetch(), start, end)
        except (ExchangeError, KeyError, IndexError, TypeError, ValueError) as exc:
            errors.append(f"{source}: {exc}")
            continue
        return Series(candles=candles, source=source, symbol=symbol)
    detail = "; ".join(errors) if errors else "no exchanges configured"
    raise ExchangeError(f"all exchanges failed: {detail}")


def fetch_range(start: int, end: int) -> Series:
    attempts: list[tuple[str, str, Callable[[], list[Candle]]]] = [
        ("Binance", "BTC/USDT", lambda host=host: _binance(host, start, end))
        for host in BINANCE_HOSTS
    ]
    attempts.append(("Kraken", "BTC/USDT", lambda: _kraken(start, end)))
    attempts.append(("Coinbase", "BTC/USDT", lambda: _coinbase("BTC-USDT", start, end)))
    attempts.append(("Coinbase", "BTC/USD", lambda: _coinbase("BTC-USD", start, end)))
    return first_ok(attempts, start, end)
