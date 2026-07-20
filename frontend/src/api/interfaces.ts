import { apiFetch } from "./client";
import {
  InterfaceApplyResultSchema,
  InterfaceRescanSchema,
  PendingChangeSchema,
  PhysicalInterfaceSchema,
  PromoteManagementResultSchema,
  type InterfaceApplyResult,
  type InterfaceRescan,
  type InterfaceUpdatePayload,
  type PhysicalInterface,
  type PromoteManagementResult,
} from "../types/interfaces";
import { z } from "zod";

export function fetchInterfaces(): Promise<PhysicalInterface[]> {
  return apiFetch("/api/v1/interfaces", (data) => z.array(PhysicalInterfaceSchema).parse(data));
}

export function rescanInterfaces(): Promise<InterfaceRescan> {
  return apiFetch("/api/v1/interfaces/rescan", (data) => InterfaceRescanSchema.parse(data), {
    method: "POST",
  });
}

export function updateInterface(
  id: string,
  payload: InterfaceUpdatePayload,
): Promise<InterfaceApplyResult> {
  return apiFetch(
    `/api/v1/interfaces/${id}`,
    (data) => InterfaceApplyResultSchema.parse(data),
    { method: "PATCH", body: payload },
  );
}

export function promoteManagement(id: string): Promise<PromoteManagementResult> {
  return apiFetch(
    `/api/v1/interfaces/${id}/promote-management`,
    (data) => PromoteManagementResultSchema.parse(data),
    { method: "POST" },
  );
}

export function confirmInterfaceChange(changeId: string): Promise<{ id: string; confirmed: boolean }> {
  return apiFetch(
    `/api/v1/interfaces/confirm-change/${changeId}`,
    (data) => PendingChangeSchema.parse(data),
    { method: "POST" },
  );
}
