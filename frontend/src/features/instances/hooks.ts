import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInstance,
  deleteInstance,
  fetchInstanceLogs,
  fetchInstances,
  restartInstance,
  startInstance,
  stopInstance,
} from "../../api/instances";
import type { InstanceCreatePayload } from "../../types/instances";

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

export function useInstanceLogs(id: string | null) {
  return useQuery({
    queryKey: ["instances", id, "logs"],
    queryFn: () => fetchInstanceLogs(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });
}
