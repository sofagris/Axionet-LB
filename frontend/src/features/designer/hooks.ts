import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDesignerManifests } from "../../api/appPackages";
import {
  createDesignFlow,
  deleteDesignFlow,
  fetchDesignFlow,
  fetchDesignFlows,
  updateDesignFlow,
} from "../../api/designFlows";
import { setRemoteDesignerManifests } from "../catalog/designerManifests";
import type {
  DesignFlowCreatePayload,
  DesignFlowUpdatePayload,
} from "../../types/designFlows";

/** Load package designer manifests from the API into the local registry. */
export function useRemoteDesignerManifests(includeReference = false) {
  const [registryRevision, setRegistryRevision] = useState(0);
  const query = useQuery({
    queryKey: ["app-packages", "designer-manifests", includeReference],
    queryFn: () => fetchDesignerManifests({ includeReference }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!query.data) return;
    setRemoteDesignerManifests(query.data);
    setRegistryRevision((value) => value + 1);
  }, [query.data]);

  return { ...query, registryRevision };
}

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
