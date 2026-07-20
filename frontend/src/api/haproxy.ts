import { z } from "zod";
import { apiFetch } from "./client";
import {
  HaproxyAclSchema,
  HaproxyBackendSchema,
  HaproxyCertificateSchema,
  HaproxyConfigPreviewSchema,
  HaproxyFrontendSchema,
  HaproxyRuntimeStatusSchema,
  HaproxyServerSchema,
  type HaproxyAcl,
  type HaproxyBackend,
  type HaproxyCertificate,
  type HaproxyFrontend,
  type HaproxyServer,
} from "../types/haproxy";

const base = (id: string) => `/api/v1/instances/${id}/haproxy`;

export function fetchHaproxyFrontends(id: string) {
  return apiFetch(`${base(id)}/frontends`, (data) => z.array(HaproxyFrontendSchema).parse(data));
}

export function createHaproxyFrontend(id: string, payload: HaproxyFrontend) {
  return apiFetch(`${base(id)}/frontends`, (data) => HaproxyFrontendSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateHaproxyFrontend(id: string, name: string, payload: HaproxyFrontend) {
  return apiFetch(`${base(id)}/frontends/${name}`, (data) => HaproxyFrontendSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteHaproxyFrontend(id: string, name: string) {
  return apiFetch(`${base(id)}/frontends/${name}`, () => undefined, { method: "DELETE" });
}

export function fetchHaproxyBackends(id: string) {
  return apiFetch(`${base(id)}/backends`, (data) => z.array(HaproxyBackendSchema).parse(data));
}

export function createHaproxyBackend(id: string, payload: HaproxyBackend) {
  return apiFetch(`${base(id)}/backends`, (data) => HaproxyBackendSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateHaproxyBackend(id: string, name: string, payload: HaproxyBackend) {
  return apiFetch(`${base(id)}/backends/${name}`, (data) => HaproxyBackendSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteHaproxyBackend(id: string, name: string) {
  return apiFetch(`${base(id)}/backends/${name}`, () => undefined, { method: "DELETE" });
}

export function createHaproxyServer(id: string, backend: string, payload: HaproxyServer) {
  return apiFetch(
    `${base(id)}/backends/${backend}/servers`,
    (data) => HaproxyServerSchema.parse(data),
    { method: "POST", body: payload },
  );
}

export function updateHaproxyServer(
  id: string,
  backend: string,
  server: string,
  payload: HaproxyServer,
) {
  return apiFetch(
    `${base(id)}/backends/${backend}/servers/${server}`,
    (data) => HaproxyServerSchema.parse(data),
    { method: "PATCH", body: payload },
  );
}

export function deleteHaproxyServer(id: string, backend: string, server: string) {
  return apiFetch(`${base(id)}/backends/${backend}/servers/${server}`, () => undefined, {
    method: "DELETE",
  });
}

export function fetchHaproxyCertificates(id: string) {
  return apiFetch(`${base(id)}/certificates`, (data) =>
    z.array(HaproxyCertificateSchema).parse(data),
  );
}

export function createHaproxyCertificate(
  id: string,
  payload: { name: string; pem: string },
): Promise<HaproxyCertificate> {
  return apiFetch(`${base(id)}/certificates`, (data) => HaproxyCertificateSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function deleteHaproxyCertificate(id: string, name: string) {
  return apiFetch(`${base(id)}/certificates/${name}`, () => undefined, { method: "DELETE" });
}

export function fetchHaproxyAcls(id: string) {
  return apiFetch(`${base(id)}/acls`, (data) => z.array(HaproxyAclSchema).parse(data));
}

export function createHaproxyAcl(id: string, payload: HaproxyAcl) {
  return apiFetch(`${base(id)}/acls`, (data) => HaproxyAclSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateHaproxyAcl(id: string, name: string, payload: HaproxyAcl) {
  return apiFetch(`${base(id)}/acls/${name}`, (data) => HaproxyAclSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteHaproxyAcl(id: string, name: string) {
  return apiFetch(`${base(id)}/acls/${name}`, () => undefined, { method: "DELETE" });
}

export function fetchHaproxyConfig(id: string) {
  return apiFetch(`${base(id)}/config`, (data) => HaproxyConfigPreviewSchema.parse(data));
}

export function fetchHaproxyStatus(id: string) {
  return apiFetch(`${base(id)}/status`, (data) => HaproxyRuntimeStatusSchema.parse(data));
}
