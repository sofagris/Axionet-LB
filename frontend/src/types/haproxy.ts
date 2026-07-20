import { z } from "zod";

export const HaproxyFrontendSchema = z.object({
  name: z.string(),
  bind_address: z.string(),
  bind_port: z.number(),
  mode: z.string(),
  default_backend: z.string(),
});

export const HaproxyServerSchema = z.object({
  name: z.string(),
  address: z.string(),
  port: z.number(),
  check: z.boolean(),
  weight: z.number(),
  inter_ms: z.number(),
  rise: z.number(),
  fall: z.number(),
});

export const HaproxyBackendSchema = z.object({
  name: z.string(),
  balance: z.string(),
  mode: z.string(),
  servers: z.array(HaproxyServerSchema),
});

export const HaproxyConfigPreviewSchema = z.object({
  configuration: z.record(z.unknown()),
  rendered: z.string(),
});

export const HaproxyStatRowSchema = z.object({
  proxy: z.string(),
  server: z.string(),
  status: z.string(),
  weight: z.string().nullable().optional(),
  current_sessions: z.string().nullable().optional(),
  max_sessions: z.string().nullable().optional(),
  total_sessions: z.string().nullable().optional(),
  bytes_in: z.string().nullable().optional(),
  bytes_out: z.string().nullable().optional(),
  check_status: z.string().nullable().optional(),
  check_code: z.string().nullable().optional(),
  downtime: z.string().nullable().optional(),
});

export const HaproxyRuntimeStatusSchema = z.object({
  instance_id: z.string(),
  available: z.boolean(),
  frontends: z.array(HaproxyStatRowSchema),
  backends: z.array(HaproxyStatRowSchema),
  servers: z.array(HaproxyStatRowSchema),
});

export type HaproxyFrontend = z.infer<typeof HaproxyFrontendSchema>;
export type HaproxyBackend = z.infer<typeof HaproxyBackendSchema>;
export type HaproxyServer = z.infer<typeof HaproxyServerSchema>;
export type HaproxyRuntimeStatus = z.infer<typeof HaproxyRuntimeStatusSchema>;
