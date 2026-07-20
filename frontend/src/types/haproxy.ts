import { z } from "zod";

export const HaproxyDefaultsSchema = z.object({
  mode: z.enum(["http", "tcp"]),
  stats_port: z.number().int(),
  timeout_connect: z.string(),
  timeout_client: z.string(),
  timeout_server: z.string(),
  compression: z.boolean().optional().default(false),
  compression_algo: z.enum(["gzip", "deflate"]).optional().default("gzip"),
  compression_type: z.string().optional().default(
    "text/html text/plain text/css text/javascript application/javascript application/json",
  ),
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
  httpchk: z.boolean().optional().default(false),
  httpchk_method: z.enum(["OPTIONS", "HEAD", "GET"]).optional().default("GET"),
  httpchk_uri: z.string().optional().default("/"),
  httpchk_expect_status: z.number().int().nullable().optional(),
  stick_table: z.boolean().optional().default(false),
  stick_table_type: z.enum(["ip", "integer", "string"]).optional().default("ip"),
  stick_table_key_len: z.number().int().optional().default(32),
  stick_table_size: z.string().optional().default("100k"),
  stick_table_expire: z.string().optional().default("30m"),
  stick_on: z.string().optional().default("src"),
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
