import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNetwork, deleteNetwork, fetchNetworks } from "../../api/networks";
import type { NetworkCreatePayload } from "../../types/networks";

export function useNetworks() {
  return useQuery({
    queryKey: ["networks"],
    queryFn: fetchNetworks,
    refetchInterval: 15_000,
  });
}

export function useCreateNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NetworkCreatePayload) => createNetwork(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["networks"] });
    },
  });
}

export function useDeleteNetwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNetwork(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["networks"] });
    },
  });
}
