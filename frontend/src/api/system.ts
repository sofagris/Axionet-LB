import { apiFetch } from "./client";
import {
  CapabilitiesSchema,
  HealthResponseSchema,
  LbMetricsSchema,
  SystemInfoSchema,
  SystemLogsSchema,
  SystemMetricsSchema,
  type Capabilities,
  type HealthResponse,
  type LbMetrics,
  type SystemInfo,
  type SystemLogs,
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

export function fetchLbMetrics(): Promise<LbMetrics> {
  return apiFetch("/api/v1/system/lb-metrics", (data) => LbMetricsSchema.parse(data));
}

export function fetchCapabilities(): Promise<Capabilities> {
  return apiFetch("/api/v1/system/capabilities", (data) => CapabilitiesSchema.parse(data));
}

export function fetchSystemLogs(): Promise<SystemLogs> {
  return apiFetch("/api/v1/system/logs", (data) => SystemLogsSchema.parse(data));
}
