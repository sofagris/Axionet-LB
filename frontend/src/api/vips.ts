import { z } from "zod";
import { apiFetch } from "./client";
import { VipSchema, type Vip, type VipCreatePayload } from "../types/vips";

export function fetchVips(): Promise<Vip[]> {
  return apiFetch("/api/v1/vips", (data) => z.array(VipSchema).parse(data));
}

export function createVip(payload: VipCreatePayload): Promise<Vip> {
  return apiFetch("/api/v1/vips", (data) => VipSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function enableVip(id: string): Promise<Vip> {
  return apiFetch(`/api/v1/vips/${id}/enable`, (data) => VipSchema.parse(data), {
    method: "POST",
  });
}

export function disableVip(id: string): Promise<Vip> {
  return apiFetch(`/api/v1/vips/${id}/disable`, (data) => VipSchema.parse(data), {
    method: "POST",
  });
}

export function deleteVip(id: string): Promise<void> {
  return apiFetch(`/api/v1/vips/${id}`, () => undefined, { method: "DELETE" });
}
