import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHaproxyBackend,
  createHaproxyFrontend,
  createHaproxyServer,
  deleteHaproxyBackend,
  deleteHaproxyFrontend,
  deleteHaproxyServer,
  fetchHaproxyBackends,
  fetchHaproxyConfig,
  fetchHaproxyFrontends,
  fetchHaproxyStatus,
} from "../../api/haproxy";
import type { HaproxyBackend, HaproxyFrontend, HaproxyServer } from "../../types/haproxy";

export function useHaproxyFrontends(id: string) {
  return useQuery({
    queryKey: ["haproxy", id, "frontends"],
    queryFn: () => fetchHaproxyFrontends(id),
  });
}

export function useHaproxyBackends(id: string) {
  return useQuery({
    queryKey: ["haproxy", id, "backends"],
    queryFn: () => fetchHaproxyBackends(id),
  });
}

export function useHaproxyConfig(id: string) {
  return useQuery({
    queryKey: ["haproxy", id, "config"],
    queryFn: () => fetchHaproxyConfig(id),
  });
}

export function useHaproxyStatus(id: string) {
  return useQuery({
    queryKey: ["haproxy", id, "status"],
    queryFn: () => fetchHaproxyStatus(id),
    refetchInterval: 5_000,
    retry: 1,
  });
}

function useInvalidate(id: string) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["haproxy", id] });
    await queryClient.invalidateQueries({ queryKey: ["revisions", id] });
    await queryClient.invalidateQueries({ queryKey: ["instances"] });
  };
}

export function useHaproxyMutations(id: string) {
  const invalidate = useInvalidate(id);
  return {
    createFrontend: useMutation({
      mutationFn: (payload: HaproxyFrontend) => createHaproxyFrontend(id, payload),
      onSuccess: invalidate,
    }),
    deleteFrontend: useMutation({
      mutationFn: (name: string) => deleteHaproxyFrontend(id, name),
      onSuccess: invalidate,
    }),
    createBackend: useMutation({
      mutationFn: (payload: HaproxyBackend) => createHaproxyBackend(id, payload),
      onSuccess: invalidate,
    }),
    deleteBackend: useMutation({
      mutationFn: (name: string) => deleteHaproxyBackend(id, name),
      onSuccess: invalidate,
    }),
    createServer: useMutation({
      mutationFn: ({ backend, server }: { backend: string; server: HaproxyServer }) =>
        createHaproxyServer(id, backend, server),
      onSuccess: invalidate,
    }),
    deleteServer: useMutation({
      mutationFn: ({ backend, server }: { backend: string; server: string }) =>
        deleteHaproxyServer(id, backend, server),
      onSuccess: invalidate,
    }),
  };
}
