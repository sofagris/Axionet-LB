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

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
export type ComponentHealth = z.infer<typeof ComponentHealthSchema>;
