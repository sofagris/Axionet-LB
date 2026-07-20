import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmInterfaceChange,
  fetchInterfaces,
  promoteManagement,
  rescanInterfaces,
  updateInterface,
} from "../../api/interfaces";
import type { InterfaceUpdatePayload } from "../../types/interfaces";

export function useInterfaces() {
  return useQuery({
    queryKey: ["interfaces"],
    queryFn: fetchInterfaces,
    refetchInterval: 15_000,
  });
}

export function useRescanInterfaces() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rescanInterfaces,
    onSuccess: (data) => {
      queryClient.setQueryData(["interfaces"], data.interfaces);
    },
  });
}

export function useUpdateInterface() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InterfaceUpdatePayload }) =>
      updateInterface(id, payload),
    onSuccess: (result) => {
      queryClient.setQueryData(["interfaces"], (prev: unknown) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((item) =>
          item.id === result.interface.id ? result.interface : item,
        );
      });
      void queryClient.invalidateQueries({ queryKey: ["system", "info"] });
    },
  });
}

export function usePromoteManagement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => promoteManagement(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["interfaces"] });
      void queryClient.invalidateQueries({ queryKey: ["system", "info"] });
    },
  });
}

export function useConfirmInterfaceChange() {
  return useMutation({
    mutationFn: (changeId: string) => confirmInterfaceChange(changeId),
  });
}
