import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDesignFlow,
  deleteDesignFlow,
  fetchDesignFlow,
  fetchDesignFlows,
  updateDesignFlow,
} from "../../api/designFlows";
import type {
  DesignFlowCreatePayload,
  DesignFlowUpdatePayload,
} from "../../types/designFlows";

export function useDesignFlows() {
  return useQuery({
    queryKey: ["design-flows"],
    queryFn: fetchDesignFlows,
  });
}

export function useDesignFlow(id: string | null) {
  return useQuery({
    queryKey: ["design-flows", id],
    queryFn: () => fetchDesignFlow(id!),
    enabled: Boolean(id),
  });
}

export function useCreateDesignFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DesignFlowCreatePayload) => createDesignFlow(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["design-flows"] });
    },
  });
}

export function useUpdateDesignFlow(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DesignFlowUpdatePayload) => {
      if (!id) throw new Error("No design flow selected");
      return updateDesignFlow(id, payload);
    },
    onSuccess: async (data) => {
      if (id) {
        queryClient.setQueryData(["design-flows", id], data);
      }
      // Refresh list only — avoid refetching the open flow (would remount canvas).
      await queryClient.invalidateQueries({ queryKey: ["design-flows"], exact: true });
    },
  });
}

export function useDeleteDesignFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flowId: string) => deleteDesignFlow(flowId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["design-flows"] });
    },
  });
}
