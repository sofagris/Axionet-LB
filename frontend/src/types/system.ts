import { z } from "zod";

export const ComponentHealthSchema = z.object({
  status: z.enum(["ok", "error", "unavailable"]),
  detail: z.string().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  service: z.string(),
  version: z.string(),
  checked_at: z.string(),
  components: z.record(ComponentHealthSchema),
});

export const SystemInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  api_prefix: z.string(),
  data_dir: z.string(),
  database_configured: z.boolean(),
  docker_configured: z.boolean(),
  management_interface: z.string().nullable().optional(),
  management_bind_ip: z.string().nullable().optional(),
});

export const SystemMetricsSchema = z.object({
  cpu_percent: z.number(),
  mem_total_bytes: z.number().int(),
  mem_available_bytes: z.number().int(),
  mem_used_percent: z.number(),
  load_avg_1: z.number().nullable().optional(),
  load_avg_5: z.number().nullable().optional(),
  load_avg_15: z.number().nullable().optional(),
  network: z
    .object({
      rx_bytes: z.number().int(),
      tx_bytes: z.number().int(),
      rx_packets: z.number().int(),
      tx_packets: z.number().int(),
      rx_errors: z.number().int(),
      tx_errors: z.number().int(),
      rx_dropped: z.number().int(),
      tx_dropped: z.number().int(),
    })
    .nullable()
    .optional(),
  interfaces: z
    .array(
      z.object({
        name: z.string(),
        link_state: z.string(),
        rx_bytes: z.number().int(),
        tx_bytes: z.number().int(),
        rx_packets: z.number().int(),
        tx_packets: z.number().int(),
        rx_errors: z.number().int(),
        tx_errors: z.number().int(),
        rx_dropped: z.number().int(),
        tx_dropped: z.number().int(),
      }),
    )
    .optional()
    .default([]),
  collected_at: z.string(),
});

export const LbInstanceMetricsSchema = z.object({
  instance_id: z.string(),
  name: z.string(),
  available: z.boolean(),
  current_sessions: z.number().int(),
  total_sessions: z.number().int(),
  session_rate: z.number().int(),
  bytes_in: z.number().int(),
  bytes_out: z.number().int(),
  request_errors: z.number().int(),
  connection_errors: z.number().int(),
  response_errors: z.number().int(),
  servers_up: z.number().int(),
  servers_down: z.number().int(),
  servers_total: z.number().int(),
  frontend_count: z.number().int(),
  backend_count: z.number().int(),
  detail: z.string().nullable().optional(),
});

export const LbMetricsSchema = z.object({
  totals: z.object({
    current_sessions: z.number().int(),
    total_sessions: z.number().int(),
    session_rate: z.number().int(),
    bytes_in: z.number().int(),
    bytes_out: z.number().int(),
    request_errors: z.number().int(),
    connection_errors: z.number().int(),
    response_errors: z.number().int(),
    servers_up: z.number().int(),
    servers_down: z.number().int(),
    servers_total: z.number().int(),
    instances_available: z.number().int(),
    instances_total: z.number().int(),
  }),
  instances: z.array(LbInstanceMetricsSchema),
  collected_at: z.string(),
});

export const CapabilitiesSchema = z.object({
  features: z.array(z.string()),
  dataplane_services: z.array(z.string()),
});

export const InstanceMetricsSchema = z.object({
  instance_id: z.string(),
  name: z.string(),
  available: z.boolean(),
  current_sessions: z.number().int(),
  total_sessions: z.number().int(),
  session_rate: z.number().int(),
  bytes_in: z.number().int(),
  bytes_out: z.number().int(),
  request_errors: z.number().int(),
  connection_errors: z.number().int(),
  response_errors: z.number().int(),
  servers_up: z.number().int(),
  servers_down: z.number().int(),
  servers_total: z.number().int(),
  frontend_count: z.number().int(),
  backend_count: z.number().int(),
  detail: z.string().nullable().optional(),
  collected_at: z.string(),
});

export const SystemLogsSchema = z.object({
  errors: z.array(
    z.object({
      instance_id: z.string(),
      name: z.string(),
      service_type: z.string(),
      actual_state: z.string(),
      health_status: z.string(),
      last_error: z.string(),
      updated_at: z.string(),
    }),
  ),
  instances: z.array(
    z.object({
      instance_id: z.string(),
      name: z.string(),
      service_type: z.string(),
      actual_state: z.string(),
      health_status: z.string(),
      has_error: z.boolean(),
      container_name: z.string().nullable().optional(),
    }),
  ),
  collected_at: z.string(),
});

export const AuditEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  actor: z.string(),
  resource_type: z.string(),
  resource_id: z.string().nullable().optional(),
  payload: z.record(z.unknown()),
  result: z.string(),
  created_at: z.string(),
});

export const AuditEventListSchema = z.object({
  events: z.array(AuditEventSchema),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
export type SystemMetrics = z.infer<typeof SystemMetricsSchema>;
export type LbMetrics = z.infer<typeof LbMetricsSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export type InstanceMetrics = z.infer<typeof InstanceMetricsSchema>;
export type SystemLogs = z.infer<typeof SystemLogsSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditEventList = z.infer<typeof AuditEventListSchema>;
export type ComponentHealth = z.infer<typeof ComponentHealthSchema>;
