import { z } from "zod";
import { apiFetch } from "./client";
import {
  HaproxyBackendSchema,
  HaproxyConfigPreviewSchema,
  HaproxyFrontendSchema,
  HaproxyRuntimeStatusSchema,
  HaproxyServerSchema,
  type HaproxyBackend,
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

export function deleteHaproxyServer(id: string, backend: string, server: string) {
  return apiFetch(`${base(id)}/backends/${backend}/servers/${server}`, () => undefined, {
    method: "DELETE",
  });
}

export function fetchHaproxyConfig(id: string) {
  return apiFetch(`${base(id)}/config`, (data) => HaproxyConfigPreviewSchema.parse(data));
}

export function fetchHaproxyStatus(id: string) {
  return apiFetch(`${base(id)}/status`, (data) => HaproxyRuntimeStatusSchema.parse(data));
}
