import { useEffect, useState } from "react";
import { ChartLineIcon, ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { CandleChart } from "@/components/CandleChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { percent, signedPercent, usd, utcLabel } from "@/lib/format";
import type { Health, Run } from "@/lib/types";

type Phase = "boot" | "running" | "ready" | "error";

let initialForecastStarted = false;

async function postRun(path: "/api/forecast" | "/api/backtest"): Promise<Run> {
  const response = await fetch(path, { method: "POST" });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return body as Run;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-lg tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"forecast" | "backtest" | null>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      while (!stop) {
        try {
          const response = await fetch("/api/health");
          if (response.ok) {
            const body = (await response.json()) as Health;
            if (stop) return;
            setHealth(body);
            if (body.error) {
              setError(body.error);
              setPhase("error");
              return;
            }
            if (body.ready) return;
          }
        } catch {
          // The Python process is still installing or booting.
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    void poll();
    return () => {
      stop = true;
    };
  }, []);

  async function execute(path: "/api/forecast" | "/api/backtest") {
    setPending(path === "/api/forecast" ? "forecast" : "backtest");
    setPhase("running");
    setError(null);
    try {
      const next = await postRun(path);
      setRun(next);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setPhase("error");
    } finally {
      setPending(null);
    }
  }

  useEffect(() => {
    if (!health?.ready || initialForecastStarted) return;
    const handle = window.setTimeout(() => {
      if (initialForecastStarted) return;
      initialForecastStarted = true;
      void execute("/api/forecast");
    }, 0);
    return () => window.clearTimeout(handle);
  }, [health]);

  const busy = phase === "boot" || phase === "running" || !health?.ready;
  const last = run?.history[run.history.length - 1];
  const forecastClose = run?.forecast[run.forecast.length - 1];
  const change =
    last && forecastClose ? ((forecastClose.close - last.close) / last.close) * 100 : null;

  const status = statusLine(phase, pending, health, error, run?.mode ?? null);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{run ? `${run.symbol} · 1h` : "BTC/USDT · 1h"}</Badge>
          <Badge variant="secondary">{health?.model ?? "Kronos-small"} · CPU</Badge>
        </div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Kronos forecast</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Last 512 closed hourly candles in, next 24 out. The chart keeps the latest 120 bars so the forecast stays readable.
        </p>
        <p className="text-xs text-muted-foreground">Research toy, not trading advice.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => void execute("/api/forecast")}>
          <ChartLineIcon data-icon="inline-start" />
          Forecast
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void execute("/api/backtest")}>
          <ClockCounterClockwiseIcon data-icon="inline-start" />
          Backtest
        </Button>
        <p className="text-xs text-muted-foreground" role="status">
          {status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {run?.mode === "backtest" ? "Predicted vs actual" : "History and forecast"}
          </CardTitle>
          <CardDescription>
            {run
              ? `${run.mode === "backtest" ? "Window from" : "Forecast from"} ${utcLabel(run.anchor)} UTC · ${run.source}`
              : "Waiting for candles"}
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <Legend swatch={HISTORY_UP} label="Up" />
              <Legend swatch={HISTORY_DOWN} label="Down" />
              <Legend swatch={FORECAST_UP} label="Forecast" />
              {run?.actual ? <Legend swatch="#1c1917" label="Actual" dashed /> : null}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2">
          {run ? (
            <CandleChart history={run.history} forecast={run.forecast} actual={run.actual} />
          ) : (
            <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
              {status}
            </div>
          )}
        </CardContent>
      </Card>

      {run ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Last close" value={last ? usd(last.close) : "—"} hint={`${run.context}-bar context`} />
          <Stat
            label="Forecast close, 24h"
            value={forecastClose ? usd(forecastClose.close) : "—"}
            hint={change === null ? undefined : signedPercent(change)}
          />
          {run.metrics ? (
            <Stat
              label="Close MAE"
              value={usd(run.metrics.mae, 2)}
              hint={`${run.metrics.maePct.toFixed(2)}% of price`}
            />
          ) : (
            <Stat label="Close MAE" value="—" hint="Run a backtest" />
          )}
          {run.metrics ? (
            <Stat
              label="Direction accuracy"
              value={percent(run.metrics.directionAccuracy)}
              hint="Close-to-close sign, 24 bars"
            />
          ) : (
            <Stat label="Direction accuracy" value="—" hint="Run a backtest" />
          )}
        </section>
      ) : null}

      {error && phase === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <footer className="text-xs text-muted-foreground">
        {run
          ? `${run.model} on ${run.device} · ${(run.elapsedMs / 1000).toFixed(1)}s · ${run.source} ${run.symbol}`
          : "Weights download from Hugging Face on the first launch."}
      </footer>
    </main>
  );
}

const HISTORY_UP = "#0f8a5f";
const HISTORY_DOWN = "#c44536";
const FORECAST_UP = "#3c4ec2";

function Legend({ swatch, label, dashed = false }: { swatch: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5"
        style={{
          background: dashed ? "transparent" : swatch,
          border: dashed ? `1.5px dashed ${swatch}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

function statusLine(
  phase: Phase,
  pending: "forecast" | "backtest" | null,
  health: Health | null,
  error: string | null,
  mode: Run["mode"] | null,
): string {
  if (phase === "running" && pending === "backtest") return "Replaying a 24-hour forecast from 30 days ago.";
  if (phase === "running") return "Forecasting the next 24 hours on CPU.";
  if (health?.error || (phase === "error" && error)) return "The model service hit an error.";
  if (!health?.ready) return "Starting Kronos-small. The first launch downloads the weights.";
  if (mode === "backtest") return "Backtest ready.";
  if (mode === "forecast") return "Forecast ready.";
  return "Ready.";
}
