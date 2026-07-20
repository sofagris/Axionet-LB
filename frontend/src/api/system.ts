import { apiFetch } from "./client";
import {
  AuditEventListSchema,
  CapabilitiesSchema,
  HealthResponseSchema,
  LbMetricsSchema,
  OrphanPruneResultSchema,
  OrphanReportSchema,
  SystemInfoSchema,
  SystemLogsSchema,
  SystemMetricsSchema,
  type AuditEventList,
  type Capabilities,
  type HealthResponse,
  type LbMetrics,
  type OrphanPruneResult,
  type OrphanReport,
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

export function fetchAuditEvents(params?: {
  limit?: number;
  offset?: number;
  event_type?: string;
  resource_type?: string;
}): Promise<AuditEventList> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.event_type) search.set("event_type", params.event_type);
  if (params?.resource_type) search.set("resource_type", params.resource_type);
  const qs = search.toString();
  return apiFetch(`/api/v1/system/audit${qs ? `?${qs}` : ""}`, (data) =>
    AuditEventListSchema.parse(data),
  );
}

export function fetchOrphans(): Promise<OrphanReport> {
  return apiFetch("/api/v1/system/orphans", (data) => OrphanReportSchema.parse(data));
}

export function pruneOrphans(body: {
  container_ids?: string[];
  network_ids?: string[];
}): Promise<OrphanPruneResult> {
  return apiFetch("/api/v1/system/orphans/prune", (data) => OrphanPruneResultSchema.parse(data), {
    method: "POST",
    body: {
      container_ids: body.container_ids ?? [],
      network_ids: body.network_ids ?? [],
    },
  });
}
