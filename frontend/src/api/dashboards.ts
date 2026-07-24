import { z } from "zod";
import { apiFetch } from "./client";
import {
  DashboardSchema,
  type Dashboard,
  type DashboardCreatePayload,
  type DashboardUpdatePayload,
  type DashboardWidgetCreatePayload,
} from "../types/dashboards";

export function fetchDashboards(): Promise<Dashboard[]> {
  return apiFetch("/api/v1/dashboards", (data) => z.array(DashboardSchema).parse(data));
}

export function fetchDashboard(id: string): Promise<Dashboard> {
  return apiFetch(`/api/v1/dashboards/${id}`, (data) => DashboardSchema.parse(data));
}

export function createDashboard(payload: DashboardCreatePayload): Promise<Dashboard> {
  return apiFetch("/api/v1/dashboards", (data) => DashboardSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateDashboard(
  id: string,
  payload: DashboardUpdatePayload,
): Promise<Dashboard> {
  return apiFetch(`/api/v1/dashboards/${id}`, (data) => DashboardSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteDashboard(id: string): Promise<void> {
  return apiFetch(`/api/v1/dashboards/${id}`, () => undefined, { method: "DELETE" });
}

export function appendDashboardWidget(
  id: string,
  payload: DashboardWidgetCreatePayload,
): Promise<Dashboard> {
  return apiFetch(`/api/v1/dashboards/${id}/widgets`, (data) => DashboardSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}
