import { z } from "zod";

export const AuthSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["local", "oidc"]),
  enabled: z.boolean(),
  description: z.string(),
  issuer_url: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  has_client_secret: z.boolean(),
  scopes: z.string(),
  claim_username: z.string(),
  claim_groups: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const UpnSuffixSchema = z.object({
  id: z.string(),
  suffix: z.string(),
  auth_source_id: z.string(),
  auth_source_name: z.string(),
  auth_source_kind: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AppIdentityProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["oidc", "saml"]),
  enabled: z.boolean(),
  customer_id: z.string().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AppIdpBindingSchema = z.object({
  id: z.string(),
  app_identity_provider_id: z.string(),
  app_identity_provider_name: z.string(),
  app_identity_provider_kind: z.string(),
  app_identity_provider_enabled: z.boolean(),
  customer_id: z.string(),
  application_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const LoginOptionsSchema = z.object({
  local_suffix: z.string(),
  suffixes: z.array(
    z.object({
      suffix: z.string(),
      auth_source_id: z.string(),
      auth_source_name: z.string(),
      kind: z.enum(["local", "oidc"]),
      sso: z.boolean(),
    }),
  ),
});

export type AuthSource = z.infer<typeof AuthSourceSchema>;
export type UpnSuffix = z.infer<typeof UpnSuffixSchema>;
export type AppIdentityProvider = z.infer<typeof AppIdentityProviderSchema>;
export type AppIdpBinding = z.infer<typeof AppIdpBindingSchema>;
export type LoginOptions = z.infer<typeof LoginOptionsSchema>;

export type AuthSourceCreatePayload = {
  name: string;
  kind: "oidc";
  enabled?: boolean;
  description?: string;
  issuer_url: string;
  client_id: string;
  client_secret?: string;
  scopes?: string;
  claim_username?: string;
  claim_groups?: string;
};

export type AuthSourceUpdatePayload = {
  name?: string;
  enabled?: boolean;
  description?: string;
  issuer_url?: string;
  client_id?: string;
  client_secret?: string;
  scopes?: string;
  claim_username?: string;
  claim_groups?: string;
};
