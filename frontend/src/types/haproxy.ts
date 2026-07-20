import { z } from "zod";

export const HaproxyDefaultsSchema = z.object({
  mode: z.enum(["http", "tcp"]),
  stats_port: z.number().int(),
  timeout_connect: z.string(),
  timeout_client: z.string(),
  timeout_server: z.string(),
});

export const HaproxyFrontendSchema = z.object({
  name: z.string(),
  bind_address: z.string(),
  bind_port: z.number(),
  mode: z.string(),
  default_backend: z.string(),
  certificate: z.string().nullable().optional(),
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

export const HaproxyCertificateSchema = z.object({
  name: z.string(),
  filename: z.string(),
  size_bytes: z.number().int(),
});

export const HaproxyMapSchema = z.object({
  name: z.string(),
  filename: z.string(),
  size_bytes: z.number().int(),
});

export const HaproxyMapDetailSchema = HaproxyMapSchema.extend({
  content: z.string(),
});

export const HaproxyAclSchema = z.object({
  name: z.string(),
  frontend: z.string(),
  expression: z.string(),
  use_backend: z.string().nullable().optional(),
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

export type HaproxyDefaults = z.infer<typeof HaproxyDefaultsSchema>;
export type HaproxyFrontend = z.infer<typeof HaproxyFrontendSchema>;
export type HaproxyBackend = z.infer<typeof HaproxyBackendSchema>;
export type HaproxyServer = z.infer<typeof HaproxyServerSchema>;
export type HaproxyCertificate = z.infer<typeof HaproxyCertificateSchema>;
export type HaproxyMap = z.infer<typeof HaproxyMapSchema>;
export type HaproxyMapDetail = z.infer<typeof HaproxyMapDetailSchema>;
export type HaproxyAcl = z.infer<typeof HaproxyAclSchema>;
export type HaproxyRuntimeStatus = z.infer<typeof HaproxyRuntimeStatusSchema>;
