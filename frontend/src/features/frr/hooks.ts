import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFrrBgp, fetchFrrConfig, updateFrrConfig } from "../../api/frr";

export function useFrrConfig(instanceId: string) {
  return useQuery({
    queryKey: ["frr", instanceId, "config"],
    queryFn: () => fetchFrrConfig(instanceId),
    enabled: Boolean(instanceId),
  });
}

export function useFrrBgp(instanceId: string, enabled = true) {
  return useQuery({
    queryKey: ["frr", instanceId, "bgp"],
    queryFn: () => fetchFrrBgp(instanceId),
    enabled: Boolean(instanceId) && enabled,
    refetchInterval: 5000,
  });
}

export function useUpdateFrrConfig(instanceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => updateFrrConfig(instanceId, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["frr", instanceId] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
      await queryClient.invalidateQueries({ queryKey: ["revisions", instanceId] });
    },
  });
}
