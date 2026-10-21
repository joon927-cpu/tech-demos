from market import (
    HOUR,
    Candle,
    ExchangeError,
    backtest_bounds,
    first_ok,
    live_bounds,
    parse_binance_klines,
    parse_coinbase_candles,
    parse_kraken_ohlc,
    require_hourly,
)


def test_parse_binance_uses_quote_volume_as_amount():
    candles = parse_binance_klines(
        [
            [
                1792555200000,
                "82733.82",
                "82899.73",
                "82733.82",
                "82816.01",
                "255.30",
                1792558799999,
                "21139916.27",
                50412,
                "165.62",
                "13713448.63",
                "0",
            ]
        ]
    )
    assert candles[0].time == 1792555200
    assert candles[0].open == 82733.82
    assert candles[0].close == 82816.01
    assert candles[0].amount == 21139916.27


def test_parse_kraken_amount_is_volume_times_vwap():
    candles = parse_kraken_ohlc(
        [[1789966800, "81406.2", "81782.5", "81300.3", "81566.4", "81452.3", "2.0", 94]]
    )
    assert candles[0].time == 1789966800
    assert candles[0].volume == 2.0
    assert candles[0].amount == 162904.6


def test_parse_coinbase_order():
    candles = parse_coinbase_candles([[1792558800, 90.0, 110.0, 100.0, 105.0, 2.0]])
    assert candles[0] == Candle(1792558800, 100.0, 110.0, 90.0, 105.0, 2.0, 210.0)


def test_require_hourly_rejects_gaps():
    start = 1_000_000 * HOUR
    candles = [
        Candle(start, 1, 1, 1, 1, 1, 1),
        Candle(start + 2 * HOUR, 1, 1, 1, 1, 1, 1),
    ]
    try:
        require_hourly(candles, start, start + 3 * HOUR)
    except ExchangeError as exc:
        assert "missing" in str(exc)
    else:
        raise AssertionError("gap should fail")


def test_first_ok_skips_a_failed_venue():
    start = 10 * HOUR

    def fail() -> list[Candle]:
        raise ExchangeError("geo-blocked")

    def succeed() -> list[Candle]:
        return [Candle(start + i * HOUR, 1, 2, 1, 2, 1, 1) for i in range(2)]

    series = first_ok(
        [("Binance", "BTC/USDT", fail), ("Kraken", "BTC/USDT", succeed)],
        start,
        start + 2 * HOUR,
    )
    assert series.source == "Kraken"
    assert len(series.candles) == 2


def test_live_and_backtest_windows():
    now = 1_800_000_000
    hist_start, forecast_start, forecast_end = live_bounds(now)
    assert forecast_start - hist_start == 512 * HOUR
    assert forecast_end - forecast_start == 24 * HOUR
    assert forecast_start == (now // HOUR) * HOUR

    back_start, back_forecast, back_end = backtest_bounds(now)
    assert back_forecast - back_start == 512 * HOUR
    assert back_end - back_forecast == 24 * HOUR
    last_closed = (now // HOUR) * HOUR - HOUR
    assert back_forecast == last_closed - 30 * 24 * HOUR
    assert back_end < forecast_start
