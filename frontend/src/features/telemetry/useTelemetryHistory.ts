import { useEffect, useState } from "react";
import type { HealthResponse } from "../../types/system";
import type { Instance } from "../../types/instances";
import type { SystemMetrics } from "../../types/system";

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
};

function countStates(instances: Instance[] | undefined) {
  const list = instances ?? [];
  return {
    running: list.filter((item) => item.actual_state === "running").length,
    degraded: list.filter((item) => item.actual_state === "degraded").length,
    error: list.filter((item) => item.actual_state === "error").length,
  };
}

export function useTelemetryHistory(input: {
  metrics?: SystemMetrics;
  health?: HealthResponse;
  instances?: Instance[];
}) {
  const [points, setPoints] = useState<TelemetryPoint[]>([]);

  useEffect(() => {
    if (!input.metrics && !input.health && !input.instances) {
      return;
    }
    const states = countStates(input.instances);
    const next: TelemetryPoint = {
      t: Date.now(),
      cpu: input.metrics?.cpu_percent ?? null,
      mem: input.metrics?.mem_used_percent ?? null,
      apiLatency: input.health?.components.api?.latency_ms ?? null,
      dbLatency: input.health?.components.database?.latency_ms ?? null,
      dockerLatency: input.health?.components.docker?.latency_ms ?? null,
      running: states.running,
      degraded: states.degraded,
      error: states.error,
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
    input.health?.checked_at,
    input.instances,
  ]);

  return points;
}
