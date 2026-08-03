import { z } from "zod";

export const SiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PlacementDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string().transform((v) => (v === "shared" ? "shared" : "site")),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  site_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const LoadBalancerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ip_address: z.string().nullable(),
  site_id: z.string().nullable(),
  is_local: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Site = z.infer<typeof SiteSchema>;
export type PlacementDomainRecord = z.infer<typeof PlacementDomainSchema>;
export type LoadBalancer = z.infer<typeof LoadBalancerSchema>;

export type SiteCreatePayload = { name: string; description?: string | null };
export type SiteUpdatePayload = { name?: string; description?: string | null };

export type PlacementDomainCreatePayload = {
  name: string;
  kind?: "site" | "shared";
  description?: string | null;
  icon?: "site" | "shared" | "building" | null;
  site_id?: string | null;
};

export type PlacementDomainUpdatePayload = {
  name?: string;
  kind?: "site" | "shared";
  description?: string | null;
  icon?: "site" | "shared" | "building" | null;
  site_id?: string | null;
};

export type LoadBalancerCreatePayload = {
  name: string;
  description?: string | null;
  ip_address?: string | null;
  site_id?: string | null;
};

export type LoadBalancerUpdatePayload = {
  name?: string;
  description?: string | null;
  ip_address?: string | null;
  site_id?: string | null;
};
