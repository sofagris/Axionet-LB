import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInstance,
  deleteInstance,
  fetchInstanceLogs,
  fetchInstances,
  restartInstance,
  startInstance,
  stopInstance,
  validateInstanceConfig,
} from "../../api/instances";
import type { InstanceCreatePayload, InstanceValidateDraftPayload } from "../../types/instances";

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

export function useInstanceAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "start" | "stop" | "restart" | "delete";
    }) => {
      if (action === "start") return startInstance(id);
      if (action === "stop") return stopInstance(id);
      if (action === "restart") return restartInstance(id);
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
