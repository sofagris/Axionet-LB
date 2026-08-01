import { z } from "zod";
import { apiFetch } from "./client";
import {
  AppIdpBindingSchema,
  AppIdentityProviderSchema,
  AuthSourceSchema,
  LoginOptionsSchema,
  UpnSuffixSchema,
  type AppIdpBinding,
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

export function fetchAppIdentityProviders(params?: {
  customer_id?: string;
}): Promise<AppIdentityProvider[]> {
  const qs =
    params?.customer_id != null && params.customer_id !== ""
      ? `?customer_id=${encodeURIComponent(params.customer_id)}`
      : "";
  return apiFetch(`/api/v1/auth-sources/app-identity-providers${qs}`, (data) =>
    z.array(AppIdentityProviderSchema).parse(data),
  );
}

export function fetchAppIdpBindings(params?: {
  customer_id?: string;
  application_id?: string;
}): Promise<AppIdpBinding[]> {
  const search = new URLSearchParams();
  if (params?.customer_id) search.set("customer_id", params.customer_id);
  if (params?.application_id !== undefined) {
    search.set("application_id", params.application_id ?? "");
  }
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch(`/api/v1/app-idp-bindings${qs}`, (data) =>
    z.array(AppIdpBindingSchema).parse(data),
  );
}

export function createAppIdpBinding(payload: {
  app_identity_provider_id: string;
  customer_id: string;
  application_id?: string | null;
}): Promise<AppIdpBinding> {
  return apiFetch("/api/v1/app-idp-bindings", (data) => AppIdpBindingSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function deleteAppIdpBinding(id: string): Promise<void> {
  return apiFetch(`/api/v1/app-idp-bindings/${id}`, () => undefined, { method: "DELETE" });
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
