import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addVipLink,
  createVip,
  deleteVip,
  disableVip,
  enableVip,
  fetchVips,
  removeVipLink,
} from "../../api/vips";
import type { VipCreatePayload, VipLinkCreatePayload } from "../../types/vips";

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

export function useAddVipLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { vipId: string; payload: VipLinkCreatePayload }) =>
      addVipLink(input.vipId, input.payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vips"] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}

export function useRemoveVipLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { vipId: string; linkId: string }) =>
      removeVipLink(input.vipId, input.linkId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vips"] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}
