import { z } from "zod";
import { apiFetch } from "./client";
import {
  AppIdentityProviderSchema,
  AuthSourceSchema,
  LoginOptionsSchema,
  UpnSuffixSchema,
  type AppIdentityProvider,
  type AuthSource,
  type AuthSourceCreatePayload,
  type AuthSourceUpdatePayload,
  type LoginOptions,
  type UpnSuffix,
} from "../types/authSources";

export function fetchLoginOptions(): Promise<LoginOptions> {
  return apiFetch(
    "/api/v1/auth/login-options",
    (data) => LoginOptionsSchema.parse(data),
    { auth: false },
  );
}

export function fetchAuthSources(): Promise<AuthSource[]> {
  return apiFetch("/api/v1/auth-sources", (data) => z.array(AuthSourceSchema).parse(data));
}

export function createAuthSource(payload: AuthSourceCreatePayload): Promise<AuthSource> {
  return apiFetch("/api/v1/auth-sources", (data) => AuthSourceSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateAuthSource(
  id: string,
  payload: AuthSourceUpdatePayload,
): Promise<AuthSource> {
  return apiFetch(`/api/v1/auth-sources/${id}`, (data) => AuthSourceSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteAuthSource(id: string): Promise<void> {
  return apiFetch(`/api/v1/auth-sources/${id}`, () => undefined, { method: "DELETE" });
}

export function fetchUpnSuffixes(): Promise<UpnSuffix[]> {
  return apiFetch("/api/v1/auth-sources/upn-suffixes", (data) =>
    z.array(UpnSuffixSchema).parse(data),
  );
}

export function createUpnSuffix(payload: {
  suffix: string;
  auth_source_id: string;
}): Promise<UpnSuffix> {
  return apiFetch("/api/v1/auth-sources/upn-suffixes", (data) => UpnSuffixSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function deleteUpnSuffix(id: string): Promise<void> {
  return apiFetch(`/api/v1/auth-sources/upn-suffixes/${id}`, () => undefined, {
    method: "DELETE",
  });
}

export function fetchAppIdentityProviders(): Promise<AppIdentityProvider[]> {
  return apiFetch("/api/v1/auth-sources/app-identity-providers", (data) =>
    z.array(AppIdentityProviderSchema).parse(data),
  );
}

export function createAppIdentityProvider(payload: {
  name: string;
  kind: "oidc" | "saml";
  enabled?: boolean;
  customer_id?: string | null;
  config?: Record<string, unknown>;
}): Promise<AppIdentityProvider> {
  return apiFetch(
    "/api/v1/auth-sources/app-identity-providers",
    (data) => AppIdentityProviderSchema.parse(data),
    { method: "POST", body: payload },
  );
}

export function deleteAppIdentityProvider(id: string): Promise<void> {
  return apiFetch(`/api/v1/auth-sources/app-identity-providers/${id}`, () => undefined, {
    method: "DELETE",
  });
}

export function oidcStartUrl(upn: string): string {
  return `/api/v1/auth/oidc/start?upn=${encodeURIComponent(upn)}`;
}
