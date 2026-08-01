import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAppIdentityProvider,
  createAuthSource,
  createUpnSuffix,
  deleteAppIdentityProvider,
  deleteAuthSource,
  deleteUpnSuffix,
  fetchAppIdentityProviders,
  fetchAuthSources,
  fetchLoginOptions,
  fetchUpnSuffixes,
  updateAuthSource,
} from "../../api/authSources";
import type { AuthSourceCreatePayload, AuthSourceUpdatePayload } from "../../types/authSources";

const sourcesKey = ["auth", "sources"] as const;
const suffixesKey = ["auth", "upn-suffixes"] as const;
const appIdpsKey = ["auth", "app-idps"] as const;

export function useLoginOptions() {
  return useQuery({ queryKey: ["auth", "login-options"], queryFn: fetchLoginOptions });
}

export function useAuthSources() {
  return useQuery({ queryKey: sourcesKey, queryFn: fetchAuthSources });
}

export function useUpnSuffixes() {
  return useQuery({ queryKey: suffixesKey, queryFn: fetchUpnSuffixes });
}

export function useAppIdentityProviders() {
  return useQuery({ queryKey: appIdpsKey, queryFn: fetchAppIdentityProviders });
}

export function useCreateAuthSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AuthSourceCreatePayload) => createAuthSource(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sourcesKey }),
  });
}

export function useUpdateAuthSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AuthSourceUpdatePayload }) =>
      updateAuthSource(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sourcesKey }),
  });
}

export function useDeleteAuthSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAuthSource(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sourcesKey });
      void qc.invalidateQueries({ queryKey: suffixesKey });
    },
  });
}

export function useCreateUpnSuffix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { suffix: string; auth_source_id: string }) => createUpnSuffix(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suffixesKey });
      void qc.invalidateQueries({ queryKey: ["auth", "login-options"] });
    },
  });
}

export function useDeleteUpnSuffix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUpnSuffix(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suffixesKey });
      void qc.invalidateQueries({ queryKey: ["auth", "login-options"] });
    },
  });
}

export function useCreateAppIdentityProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAppIdentityProvider,
    onSuccess: () => void qc.invalidateQueries({ queryKey: appIdpsKey }),
  });
}

export function useDeleteAppIdentityProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAppIdentityProvider(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: appIdpsKey }),
  });
}
