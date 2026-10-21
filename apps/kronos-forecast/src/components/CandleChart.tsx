import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";

const HISTORY_UP = "#0f8a5f";
const HISTORY_DOWN = "#c44536";
const FORECAST_UP = "#3c4ec2";
const FORECAST_DOWN = "#6d4bb3";
const ACTUAL = "#1c1917";

type Props = {
  history: Candle[];
  forecast: Candle[];
  actual: Candle[] | null;
};

function stamp(time: number): UTCTimestamp {
  return time as UTCTimestamp;
}

function candlePoint(bar: Candle, up: string, down: string) {
  const rising = bar.close >= bar.open;
  const color = rising ? up : down;
  return {
    time: stamp(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    color,
    borderColor: color,
    wickColor: color,
  };
}

export function CandleChart({ history, forecast, actual }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || history.length === 0 || forecast.length === 0) return;

    const chart: IChartApi = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#3f3f46",
        fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.05)" },
        horzLines: { color: "rgba(0,0,0,0.05)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      crosshair: {
        vertLine: { color: "rgba(0,0,0,0.25)", labelBackgroundColor: "#18181b" },
        horzLine: { color: "rgba(0,0,0,0.25)", labelBackgroundColor: "#18181b" },
      },
    });

    const candles: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: HISTORY_UP,
      downColor: HISTORY_DOWN,
      borderVisible: false,
      wickUpColor: HISTORY_UP,
      wickDownColor: HISTORY_DOWN,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    candles.setData([
      ...history.map((bar) => candlePoint(bar, HISTORY_UP, HISTORY_DOWN)),
      ...forecast.map((bar) => candlePoint(bar, FORECAST_UP, FORECAST_DOWN)),
    ]);

    createSeriesMarkers(candles, [
      {
        time: stamp(forecast[0].time),
        position: "aboveBar",
        color: FORECAST_UP,
        shape: "arrowDown",
        text: "Forecast",
      },
    ]);

    if (actual && actual.length > 0) {
      const line = chart.addSeries(LineSeries, {
        color: ACTUAL,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "Actual",
      });
      const anchor = history[history.length - 1];
      line.setData([
        { time: stamp(anchor.time), value: anchor.close },
        ...actual.map((bar) => ({ time: stamp(bar.time), value: bar.close })),
      ]);
    }

    const fit = () => chart.timeScale().fitContent();
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [history, forecast, actual]);

  return <div ref={host} className="h-[420px] w-full" />;
}
