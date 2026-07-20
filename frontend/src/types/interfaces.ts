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

export type PhysicalInterface = z.infer<typeof PhysicalInterfaceSchema>;
export type InterfaceRescan = z.infer<typeof InterfaceRescanSchema>;
