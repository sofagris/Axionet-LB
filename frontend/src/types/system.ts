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

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
export type SystemMetrics = z.infer<typeof SystemMetricsSchema>;
export type ComponentHealth = z.infer<typeof ComponentHealthSchema>;
