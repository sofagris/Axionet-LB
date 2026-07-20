import { z } from "zod";

export const InstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  service_type: z.string(),
  desired_state: z.enum(["running", "stopped", "deleted"]),
  actual_state: z.enum([
    "unknown",
    "pending",
    "creating",
    "starting",
    "running",
    "degraded",
    "stopping",
    "stopped",
    "error",
    "deleting",
  ]),
  image: z.string(),
  image_version: z.string(),
  restart_policy: z.string(),
  configuration: z.record(z.unknown()),
  container_id: z.string().nullable(),
  container_name: z.string().nullable(),
  last_error: z.string().nullable(),
  health_status: z.enum(["unknown", "healthy", "unhealthy"]),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  stopped_at: z.string().nullable(),
  networks: z.array(
    z.object({
      id: z.string(),
      network_id: z.string(),
      ip_address: z.string().nullable(),
      gateway: z.string().nullable(),
      interface_alias: z.string().nullable(),
      attachment_order: z.number(),
      created_at: z.string(),
    }),
  ),
});

export const InstanceLogsSchema = z.object({
  id: z.string(),
  logs: z.string(),
});

export type Instance = z.infer<typeof InstanceSchema>;

export type InstanceCreatePayload = {
  name: string;
  service_type?: string;
  desired_state?: "running" | "stopped";
  image_version?: string;
  configuration?: Record<string, unknown>;
  networks?: Array<{ network_id: string; ip_address?: string | null }>;
};

export type InstanceValidateDraftPayload = {
  service_type?: string;
  image_version?: string;
  configuration?: Record<string, unknown> | null;
};

export type InstanceValidateResult = {
  ok: boolean;
  output: string;
  rendered_preview: string | null;
};
