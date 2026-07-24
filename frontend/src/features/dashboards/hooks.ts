import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appendDashboardWidget,
  createDashboard,
  deleteDashboard,
  fetchDashboard,
  fetchDashboards,
  updateDashboard,
} from "../../api/dashboards";
import type {
  DashboardCreatePayload,
  DashboardUpdatePayload,
  DashboardWidgetCreatePayload,
} from "../../types/dashboards";

export function useDashboards() {
  return useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  });
}

export function useDashboard(id: string) {
  return useQuery({
    queryKey: ["dashboards", id],
    queryFn: () => fetchDashboard(id),
    enabled: Boolean(id),
  });
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DashboardCreatePayload) => createDashboard(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useUpdateDashboard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DashboardUpdatePayload) => updateDashboard(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboards", id] });
    },
  });
}

export function useDeleteDashboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dashboardId: string) => deleteDashboard(dashboardId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useAppendDashboardWidget(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DashboardWidgetCreatePayload) => appendDashboardWidget(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboards", id] });
    },
  });
}

export function usePublishWidget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dashboardId: string;
      payload: DashboardWidgetCreatePayload;
    }) => appendDashboardWidget(input.dashboardId, input.payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      await queryClient.invalidateQueries({
        queryKey: ["dashboards", variables.dashboardId],
      });
    },
  });
}
