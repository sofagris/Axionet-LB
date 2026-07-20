import { z } from "zod";
import { apiFetch } from "./client";
import {
  NetworkSchema,
  NetworkValidationSchema,
  type Network,
  type NetworkCreatePayload,
} from "../types/networks";

export function fetchNetworks(): Promise<Network[]> {
  return apiFetch("/api/v1/networks", (data) => z.array(NetworkSchema).parse(data));
}

export function createNetwork(payload: NetworkCreatePayload): Promise<Network> {
  return apiFetch("/api/v1/networks", (data) => NetworkSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function deleteNetwork(id: string): Promise<void> {
  return apiFetch(
    `/api/v1/networks/${id}`,
    () => undefined,
    { method: "DELETE" },
  );
}

export function validateNetwork(payload: NetworkCreatePayload) {
  return apiFetch("/api/v1/networks/validate", (data) => NetworkValidationSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}
