import { z } from "zod";
import { apiFetch } from "./client";

const FrrConfigPreviewSchema = z.object({
  configuration: z.record(z.unknown()),
  rendered: z.string(),
});

const FrrBgpStatusSchema = z.object({
  summary: z.string(),
  neighbors: z.string(),
});

export type FrrConfigPreview = z.infer<typeof FrrConfigPreviewSchema>;
export type FrrBgpStatus = z.infer<typeof FrrBgpStatusSchema>;

const base = (id: string) => `/api/v1/instances/${id}/frr`;

export function fetchFrrConfig(instanceId: string): Promise<FrrConfigPreview> {
  return apiFetch(`${base(instanceId)}/config`, (data) => FrrConfigPreviewSchema.parse(data));
}

export function updateFrrConfig(
  instanceId: string,
  body: Record<string, unknown>,
): Promise<FrrConfigPreview> {
  return apiFetch(`${base(instanceId)}/config`, (data) => FrrConfigPreviewSchema.parse(data), {
    method: "PUT",
    body,
  });
}

export function fetchFrrBgp(instanceId: string): Promise<FrrBgpStatus> {
  return apiFetch(`${base(instanceId)}/bgp`, (data) => FrrBgpStatusSchema.parse(data));
}
