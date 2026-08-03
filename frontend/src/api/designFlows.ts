import { z } from "zod";
import { apiFetch } from "./client";
import {
  DesignFlowSchema,
  type DesignFlow,
  type DesignFlowCreatePayload,
  type DesignFlowUpdatePayload,
} from "../types/designFlows";

export function fetchDesignFlows(): Promise<DesignFlow[]> {
  return apiFetch("/api/v1/design-flows", (data) => z.array(DesignFlowSchema).parse(data));
}

export function fetchDesignFlow(id: string): Promise<DesignFlow> {
  return apiFetch(`/api/v1/design-flows/${id}`, (data) => DesignFlowSchema.parse(data));
}

export function createDesignFlow(payload: DesignFlowCreatePayload): Promise<DesignFlow> {
  return apiFetch("/api/v1/design-flows", (data) => DesignFlowSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateDesignFlow(
  id: string,
  payload: DesignFlowUpdatePayload,
): Promise<DesignFlow> {
  return apiFetch(`/api/v1/design-flows/${id}`, (data) => DesignFlowSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteDesignFlow(id: string): Promise<void> {
  return apiFetch(`/api/v1/design-flows/${id}`, () => undefined, { method: "DELETE" });
}
