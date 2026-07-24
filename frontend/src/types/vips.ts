import { z } from "zod";

export const VipSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  mode: z.enum(["same_l2", "routed"]).default("same_l2"),
  backend_ip: z.string().nullable().optional(),
  haproxy_instance_id: z.string(),
  frr_instance_id: z.string(),
  network_id: z.string(),
  enabled: z.boolean(),
  advertise: z.boolean(),
  attached: z.boolean(),
  dataplane_ready: z.boolean().default(false),
  advertised: z.boolean(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  announce_prefix: z.string().nullable().optional(),
});

export type Vip = z.infer<typeof VipSchema>;

export type VipCreatePayload = {
  name: string;
  address: string;
  haproxy_instance_id: string;
  frr_instance_id: string;
  network_id: string;
  mode?: "same_l2" | "routed";
  backend_ip?: string | null;
  enabled?: boolean;
  advertise?: boolean;
  bind_frontends?: boolean;
};
