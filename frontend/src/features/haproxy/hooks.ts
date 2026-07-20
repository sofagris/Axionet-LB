import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHaproxyAcl,
  createHaproxyBackend,
  createHaproxyCertificate,
  createHaproxyFrontend,
  createHaproxyServer,
  deleteHaproxyAcl,
  deleteHaproxyBackend,
  deleteHaproxyCertificate,
  deleteHaproxyFrontend,
  deleteHaproxyServer,
  fetchHaproxyAcls,
  fetchHaproxyBackends,
  fetchHaproxyCertificates,
  fetchHaproxyConfig,
  fetchHaproxyFrontends,
  fetchHaproxyStatus,
  runtimeServerAction,
  updateHaproxyAcl,
  updateHaproxyBackend,
  updateHaproxyFrontend,
  updateHaproxyServer,
  type HaproxyRuntimeServerAction,
} from "../../api/haproxy";
import type { HaproxyAcl, HaproxyBackend, HaproxyFrontend, HaproxyServer } from "../../types/haproxy";

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

export function useHaproxyCertificates(id: string) {
  return useQuery({
    queryKey: ["haproxy", id, "certificates"],
    queryFn: () => fetchHaproxyCertificates(id),
  });
}

export function useHaproxyAcls(id: string) {
  return useQuery({
    queryKey: ["haproxy", id, "acls"],
    queryFn: () => fetchHaproxyAcls(id),
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
    updateFrontend: useMutation({
      mutationFn: ({ name, payload }: { name: string; payload: HaproxyFrontend }) =>
        updateHaproxyFrontend(id, name, payload),
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
    updateBackend: useMutation({
      mutationFn: ({ name, payload }: { name: string; payload: HaproxyBackend }) =>
        updateHaproxyBackend(id, name, payload),
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
    updateServer: useMutation({
      mutationFn: ({
        backend,
        name,
        server,
      }: {
        backend: string;
        name: string;
        server: HaproxyServer;
      }) => updateHaproxyServer(id, backend, name, server),
      onSuccess: invalidate,
    }),
    deleteServer: useMutation({
      mutationFn: ({ backend, server }: { backend: string; server: string }) =>
        deleteHaproxyServer(id, backend, server),
      onSuccess: invalidate,
    }),
    createCertificate: useMutation({
      mutationFn: (payload: { name: string; pem: string }) => createHaproxyCertificate(id, payload),
      onSuccess: invalidate,
    }),
    deleteCertificate: useMutation({
      mutationFn: (name: string) => deleteHaproxyCertificate(id, name),
      onSuccess: invalidate,
    }),
    createAcl: useMutation({
      mutationFn: (payload: HaproxyAcl) => createHaproxyAcl(id, payload),
      onSuccess: invalidate,
    }),
    updateAcl: useMutation({
      mutationFn: ({ name, payload }: { name: string; payload: HaproxyAcl }) =>
        updateHaproxyAcl(id, name, payload),
      onSuccess: invalidate,
    }),
    deleteAcl: useMutation({
      mutationFn: (name: string) => deleteHaproxyAcl(id, name),
      onSuccess: invalidate,
    }),
    runtimeServer: useMutation({
      mutationFn: ({
        backend,
        server,
        action,
        weight,
      }: {
        backend: string;
        server: string;
        action: HaproxyRuntimeServerAction;
        weight?: number;
      }) => runtimeServerAction(id, backend, server, { action, weight }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["haproxy", id, "status"] });
      },
    }),
  };
}
