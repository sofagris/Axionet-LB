import { apiFetch } from "./client";
import {
  HealthResponseSchema,
  SystemInfoSchema,
  SystemMetricsSchema,
  type HealthResponse,
  type SystemInfo,
  type SystemMetrics,
} from "../types/system";

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch("/api/v1/system/health", (data) => HealthResponseSchema.parse(data));
}

export function fetchSystemInfo(): Promise<SystemInfo> {
  return apiFetch("/api/v1/system", (data) => SystemInfoSchema.parse(data));
}

export function fetchSystemMetrics(): Promise<SystemMetrics> {
  return apiFetch("/api/v1/system/metrics", (data) => SystemMetricsSchema.parse(data));
}
