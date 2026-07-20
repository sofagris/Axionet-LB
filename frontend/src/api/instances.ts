import { z } from "zod";
import { apiFetch } from "./client";
import {
  InstanceLogsSchema,
  InstanceSchema,
  type Instance,
  type InstanceCreatePayload,
  type InstanceValidateDraftPayload,
  type InstanceValidateResult,
} from "../types/instances";

export function fetchInstances(): Promise<Instance[]> {
  return apiFetch("/api/v1/instances", (data) => z.array(InstanceSchema).parse(data));
}

export function createInstance(payload: InstanceCreatePayload): Promise<Instance> {
  return apiFetch("/api/v1/instances", (data) => InstanceSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function validateInstanceConfig(
  payload: InstanceValidateDraftPayload,
): Promise<InstanceValidateResult> {
  return apiFetch(
    "/api/v1/instances/validate-config",
    (data) =>
      z
        .object({
          ok: z.boolean(),
          output: z.string(),
          rendered_preview: z.string().nullable(),
        })
        .parse(data),
    {
      method: "POST",
      body: payload,
    },
  );
}

export function startInstance(id: string): Promise<Instance> {
  return apiFetch(`/api/v1/instances/${id}/start`, (data) => InstanceSchema.parse(data), {
    method: "POST",
  });
}

export function stopInstance(id: string): Promise<Instance> {
  return apiFetch(`/api/v1/instances/${id}/stop`, (data) => InstanceSchema.parse(data), {
    method: "POST",
  });
}

export function restartInstance(id: string): Promise<Instance> {
  return apiFetch(`/api/v1/instances/${id}/restart`, (data) => InstanceSchema.parse(data), {
    method: "POST",
  });
}

export function deleteInstance(id: string): Promise<void> {
  return apiFetch(`/api/v1/instances/${id}`, () => undefined, { method: "DELETE" });
}

export function fetchInstanceLogs(
  id: string,
  tail = 200,
): Promise<{ id: string; logs: string }> {
  return apiFetch(
    `/api/v1/instances/${id}/logs?tail=${tail}`,
    (data) => InstanceLogsSchema.parse(data),
  );
}
