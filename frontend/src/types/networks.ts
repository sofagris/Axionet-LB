import { z } from "zod";

export const NetworkTypeSchema = z.enum([
  "management",
  "bridge",
  "ipvlan-l2",
  "ipvlan-l3",
  "macvlan",
  "untagged-access",
]);

export const NetworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  network_type: NetworkTypeSchema,
  parent_interface_id: z.string().nullable(),
  vlan_id: z.number().nullable(),
  subnet: z.string().nullable(),
  gateway: z.string().nullable(),
  ip_range: z.string().nullable(),
  mtu: z.number().nullable(),
  docker_network_id: z.string().nullable(),
  docker_network_name: z.string().nullable(),
  parent_device: z.string().nullable(),
  enabled: z.boolean(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  docker_exists: z.boolean(),
});

export const NetworkValidationSchema = z.object({
  valid: z.boolean(),
  issues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.string(),
    }),
  ),
});

export type Network = z.infer<typeof NetworkSchema>;
export type NetworkType = z.infer<typeof NetworkTypeSchema>;
export type NetworkCreatePayload = {
  name: string;
  network_type: NetworkType;
  parent_interface_id?: string | null;
  vlan_id?: number | null;
  subnet?: string | null;
  gateway?: string | null;
  ip_range?: string | null;
  mtu?: number | null;
  enabled?: boolean;
};
