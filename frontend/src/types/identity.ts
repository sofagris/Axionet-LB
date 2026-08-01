import { z } from "zod";

export const PlatformRoleSchema = z.enum(["admin", "operator", "viewer"]);
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

export const IdentityUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  email: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  auth_source: z.string().default("local"),
  is_active: z.boolean(),
  groups: z.array(z.string()).default([]),
  effective_role: z.string().default("viewer"),
  created_at: z.string(),
});

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  role: z.string(),
  member_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type IdentityUser = z.infer<typeof IdentityUserSchema>;
export type Group = z.infer<typeof GroupSchema>;

export type UserCreatePayload = {
  username: string;
  password: string;
  role: PlatformRole;
  email?: string | null;
  display_name?: string | null;
  group_ids?: string[];
  is_active?: boolean;
};

export type UserUpdatePayload = {
  role?: PlatformRole;
  email?: string | null;
  display_name?: string | null;
  password?: string;
  is_active?: boolean;
  group_ids?: string[];
};

export type GroupCreatePayload = {
  name: string;
  description?: string;
  role: PlatformRole;
};

export type GroupUpdatePayload = {
  name?: string;
  description?: string;
  role?: PlatformRole;
};
