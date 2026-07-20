import { useEffect, useRef, useState } from "react";
import type { HealthResponse, LbMetrics, SystemMetrics } from "../../types/system";
import type { Instance } from "../../types/instances";

const MAX_POINTS = 60;

export type TelemetryPoint = {
  t: number;
  cpu: number | null;
  mem: number | null;
  apiLatency: number | null;
  dbLatency: number | null;
  dockerLatency: number | null;
  running: number;
  degraded: number;
  error: number;
  rxBps: number | null;
  txBps: number | null;
  rxErrors: number | null;
  txErrors: number | null;
  sessions: number | null;
  sessionRate: number | null;
  lbRxBps: number | null;
  lbTxBps: number | null;
  serversUp: number | null;
  serversDown: number | null;
};

type CounterSnapshot = {
  t: number;
  rx: number;
  tx: number;
};

function countStates(instances: Instance[] | undefined) {
  const list = instances ?? [];
  return {
    running: list.filter((item) => item.actual_state === "running").length,
    degraded: list.filter((item) => item.actual_state === "degraded").length,
    error: list.filter((item) => item.actual_state === "error").length,
  };
}

function rateBps(prev: CounterSnapshot | null, next: CounterSnapshot, key: "rx" | "tx"): number | null {
  if (!prev || next.t <= prev.t) {
    return null;
  }
  const seconds = (next.t - prev.t) / 1000;
  if (seconds <= 0) {
    return null;
  }
  const delta = next[key] - prev[key];
  if (delta < 0) {
    return null;
  }
  return (delta * 8) / seconds;
}

export function useTelemetryHistory(input: {
  metrics?: SystemMetrics;
  health?: HealthResponse;
  instances?: Instance[];
  lbMetrics?: LbMetrics;
}) {
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const prevCounters = useRef<CounterSnapshot | null>(null);
  const prevLbCounters = useRef<CounterSnapshot | null>(null);

  useEffect(() => {
    if (!input.metrics && !input.health && !input.instances && !input.lbMetrics) {
      return;
    }
    const states = countStates(input.instances);
    const now = Date.now();
    let rxBps: number | null = null;
    let txBps: number | null = null;
    if (input.metrics?.network) {
      const snap: CounterSnapshot = {
        t: now,
        rx: input.metrics.network.rx_bytes,
        tx: input.metrics.network.tx_bytes,
      };
      rxBps = rateBps(prevCounters.current, snap, "rx");
      txBps = rateBps(prevCounters.current, snap, "tx");
      prevCounters.current = snap;
    }

    let lbRxBps: number | null = null;
    let lbTxBps: number | null = null;
    if (input.lbMetrics) {
      const snap: CounterSnapshot = {
        t: now,
        rx: input.lbMetrics.totals.bytes_in,
        tx: input.lbMetrics.totals.bytes_out,
      };
      lbRxBps = rateBps(prevLbCounters.current, snap, "rx");
      lbTxBps = rateBps(prevLbCounters.current, snap, "tx");
      prevLbCounters.current = snap;
    }

    const next: TelemetryPoint = {
      t: now,
      cpu: input.metrics?.cpu_percent ?? null,
      mem: input.metrics?.mem_used_percent ?? null,
      apiLatency: input.health?.components.api?.latency_ms ?? null,
      dbLatency: input.health?.components.database?.latency_ms ?? null,
      dockerLatency: input.health?.components.docker?.latency_ms ?? null,
      running: states.running,
      degraded: states.degraded,
      error: states.error,
      rxBps,
      txBps,
      rxErrors: input.metrics?.network?.rx_errors ?? null,
      txErrors: input.metrics?.network?.tx_errors ?? null,
      sessions: input.lbMetrics?.totals.current_sessions ?? null,
      sessionRate: input.lbMetrics?.totals.session_rate ?? null,
      lbRxBps,
      lbTxBps,
      serversUp: input.lbMetrics?.totals.servers_up ?? null,
      serversDown: input.lbMetrics?.totals.servers_down ?? null,
    };
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && next.t - last.t < 2_000) {
        return [...prev.slice(0, -1), next].slice(-MAX_POINTS);
      }
      return [...prev, next].slice(-MAX_POINTS);
    });
  }, [
    input.metrics?.collected_at,
    input.metrics?.cpu_percent,
    input.metrics?.mem_used_percent,
    input.metrics?.network?.rx_bytes,
    input.metrics?.network?.tx_bytes,
    input.health?.checked_at,
    input.instances,
    input.lbMetrics?.collected_at,
    input.lbMetrics?.totals.current_sessions,
    input.lbMetrics?.totals.bytes_in,
    input.lbMetrics?.totals.bytes_out,
  ]);

  return points;
}
