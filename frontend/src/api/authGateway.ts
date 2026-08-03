import { z } from "zod";
import { apiFetch } from "./client";

const AuthGatewayOverviewSchema = z.object({
  instance_id: z.string(),
  service_type: z.string(),
  upstream_url: z.string(),
  oidc_issuer_url: z.string(),
  client_id: z.string(),
  http_port: z.number(),
  redirect_url: z.string().nullable().optional(),
  listen_url: z.string().nullable().optional(),
  attachment_ips: z.array(z.string()),
  pass_user_headers: z.boolean().optional(),
});

export type AuthGatewayOverview = z.infer<typeof AuthGatewayOverviewSchema>;

export function fetchAuthGatewayOverview(instanceId: string): Promise<AuthGatewayOverview> {
  return apiFetch(
    `/api/v1/instances/${instanceId}/auth-gateway/overview`,
    (data) => AuthGatewayOverviewSchema.parse(data),
  );
}
