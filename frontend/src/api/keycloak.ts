import { z } from "zod";
import { apiFetch } from "./client";

const KeycloakOverviewSchema = z.object({
  instance_id: z.string(),
  service_type: z.string(),
  realm: z.string(),
  http_port: z.number(),
  hostname: z.string().nullable().optional(),
  issuer_url: z.string().nullable().optional(),
  admin_console_url: z.string().nullable().optional(),
  gui_client_id: z.string(),
  app_client_id: z.string(),
  attachment_ips: z.array(z.string()),
});

const KeycloakWireOidcResponseSchema = z.object({
  auth_source_id: z.string(),
  auth_source_name: z.string(),
  issuer_url: z.string(),
  upn_suffix: z.string(),
  gui_client_id: z.string(),
});

export type KeycloakOverview = z.infer<typeof KeycloakOverviewSchema>;
export type KeycloakWireOidcResponse = z.infer<typeof KeycloakWireOidcResponseSchema>;

const base = (id: string) => `/api/v1/instances/${id}/keycloak`;

export function fetchKeycloakOverview(instanceId: string): Promise<KeycloakOverview> {
  return apiFetch(`${base(instanceId)}/overview`, (data) => KeycloakOverviewSchema.parse(data));
}

export function wireKeycloakPlatformOidc(
  instanceId: string,
  body: { source_name?: string; upn_suffix?: string } = {},
): Promise<KeycloakWireOidcResponse> {
  return apiFetch(
    `${base(instanceId)}/wire-platform-oidc`,
    (data) => KeycloakWireOidcResponseSchema.parse(data),
    { method: "POST", body },
  );
}

const KeycloakWireAppIdpResponseSchema = z.object({
  app_identity_provider_id: z.string(),
  app_identity_provider_name: z.string(),
  issuer_url: z.string(),
  app_client_id: z.string(),
  customer_id: z.string().nullable().optional(),
  application_id: z.string().nullable().optional(),
  binding_id: z.string().nullable().optional(),
});

export type KeycloakWireAppIdpResponse = z.infer<typeof KeycloakWireAppIdpResponseSchema>;

export function wireKeycloakAppIdp(
  instanceId: string,
  body: {
    idp_name?: string;
    customer_id?: string | null;
    application_id?: string | null;
  } = {},
): Promise<KeycloakWireAppIdpResponse> {
  return apiFetch(
    `${base(instanceId)}/wire-app-idp`,
    (data) => KeycloakWireAppIdpResponseSchema.parse(data),
    { method: "POST", body },
  );
}
