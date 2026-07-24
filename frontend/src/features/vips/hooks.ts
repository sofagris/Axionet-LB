import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createVip, deleteVip, disableVip, enableVip, fetchVips } from "../../api/vips";
import type { VipCreatePayload } from "../../types/vips";

export function useVips() {
  return useQuery({
    queryKey: ["vips"],
    queryFn: fetchVips,
    refetchInterval: 10_000,
  });
}

export function useCreateVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VipCreatePayload) => createVip(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vips"] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}

export function useEnableVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enableVip(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vips"] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}

export function useDisableVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disableVip(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vips"] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}

export function useDeleteVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVip(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vips"] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}
