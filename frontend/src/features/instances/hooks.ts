import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInstance,
  deleteInstance,
  fetchInstanceLogs,
  fetchInstanceMetrics,
  fetchInstances,
  reconcileInstance,
  reloadInstance,
  restartInstance,
  startInstance,
  stopInstance,
  validateInstance,
  validateInstanceConfig,
} from "../../api/instances";
import type {
  InstanceCreatePayload,
  InstanceValidateDraftPayload,
  InstanceValidateResult,
} from "../../types/instances";

export function useInstances() {
  return useQuery({
    queryKey: ["instances"],
    queryFn: fetchInstances,
    refetchInterval: 10_000,
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InstanceCreatePayload) => createInstance(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}

export function useValidateInstanceConfig() {
  return useMutation({
    mutationFn: (payload: InstanceValidateDraftPayload) => validateInstanceConfig(payload),
  });
}

export function useInstanceMetrics(id: string | null) {
  return useQuery({
    queryKey: ["instances", id, "metrics"],
    queryFn: () => fetchInstanceMetrics(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });
}

export function useValidateExistingInstance() {
  return useMutation({
    mutationFn: (id: string) => validateInstance(id),
  });
}

export type InstanceAction =
  | "start"
  | "stop"
  | "restart"
  | "reload"
  | "reconcile"
  | "delete";

export function useInstanceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: InstanceAction }) => {
      if (action === "start") return startInstance(id);
      if (action === "stop") return stopInstance(id);
      if (action === "restart") return restartInstance(id);
      if (action === "reload") return reloadInstance(id);
      if (action === "reconcile") return reconcileInstance(id);
      await deleteInstance(id);
      return null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}

export function useInstanceLogs(id: string | null, tail = 200) {
  return useQuery({
    queryKey: ["instances", id, "logs", tail],
    queryFn: () => fetchInstanceLogs(id!, tail),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });
}

export type { InstanceValidateResult };
