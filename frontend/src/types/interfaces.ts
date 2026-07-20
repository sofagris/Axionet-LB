import { z } from "zod";

export const PhysicalInterfaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  mac_address: z.string().nullable(),
  pci_address: z.string().nullable(),
  numa_node: z.number().nullable(),
  speed_mbps: z.number().nullable(),
  driver: z.string().nullable(),
  description: z.string().nullable(),
  mtu: z.number().nullable(),
  link_state: z.enum(["up", "down", "unknown"]),
  administrative_state: z.enum(["enabled", "disabled"]),
  exclusive_use: z.boolean(),
  is_management: z.boolean().default(false),
  discovered_at: z.string(),
  updated_at: z.string(),
});

export const InterfaceRescanSchema = z.object({
  discovered: z.number(),
  created: z.number(),
  updated: z.number(),
  removed: z.number(),
  interfaces: z.array(PhysicalInterfaceSchema),
});

export const InterfaceApplyResultSchema = z.object({
  interface: PhysicalInterfaceSchema,
  pending_change_id: z.string().nullable().optional(),
  rollback_at: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
});

export const PromoteManagementResultSchema = z.object({
  interface: PhysicalInterfaceSchema,
  management_bind_ip: z.string(),
  compose_hint: z.string(),
  requires_compose_recreate: z.boolean(),
});

export const PendingChangeSchema = z.object({
  id: z.string(),
  interface_id: z.string(),
  interface_name: z.string(),
  rollback_at: z.string(),
  confirmed: z.boolean(),
});

export type PhysicalInterface = z.infer<typeof PhysicalInterfaceSchema>;
export type InterfaceRescan = z.infer<typeof InterfaceRescanSchema>;
export type InterfaceApplyResult = z.infer<typeof InterfaceApplyResultSchema>;
export type PromoteManagementResult = z.infer<typeof PromoteManagementResultSchema>;

export type InterfaceUpdatePayload = {
  description?: string | null;
  administrative_state?: "enabled" | "disabled";
  exclusive_use?: boolean;
  mtu?: number;
  speed_mbps?: number;
  speed_autoneg?: boolean;
  confirm?: boolean;
};
