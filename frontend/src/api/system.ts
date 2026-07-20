import { apiFetch } from "./client";
import {
  HealthResponseSchema,
  SystemInfoSchema,
  type HealthResponse,
  type SystemInfo,
} from "../types/system";

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch("/api/v1/system/health", (data) => HealthResponseSchema.parse(data));
}

export function fetchSystemInfo(): Promise<SystemInfo> {
  return apiFetch("/api/v1/system", (data) => SystemInfoSchema.parse(data));
}
