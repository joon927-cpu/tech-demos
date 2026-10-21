export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Metrics = {
  mae: number;
  maePct: number;
  directionAccuracy: number;
};

export type Run = {
  mode: "forecast" | "backtest";
  symbol: string;
  interval: string;
  source: string;
  model: string;
  device: string;
  context: number;
  horizon: number;
  anchor: string;
  history: Candle[];
  forecast: Candle[];
  actual: Candle[] | null;
  metrics: Metrics | null;
  elapsedMs: number;
};

export type Health = {
  ready: boolean;
  model: string;
  device: string;
  error: string | null;
};
