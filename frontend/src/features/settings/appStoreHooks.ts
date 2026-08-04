import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAppStoreSource,
  createAppStoreTrustKey,
  deleteAppStoreSource,
  deleteAppStoreTrustKey,
  fetchAppStoreSources,
  fetchAppStoreTrust,
  updateAppStoreTrust,
  type AppStoreSource,
} from "../../api/appPackages";

export function useAppStoreSources() {
  return useQuery({
    queryKey: ["app-store", "sources"],
    queryFn: fetchAppStoreSources,
  });
}

export function useAppStoreTrust() {
  return useQuery({
    queryKey: ["app-store", "trust"],
    queryFn: fetchAppStoreTrust,
  });
}

export function useAppStoreSettingsMutations() {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["app-store"] }),
      queryClient.invalidateQueries({ queryKey: ["app-packages", "store"] }),
    ]);
  };

  return {
    createSource: useMutation({
      mutationFn: createAppStoreSource,
      onSuccess: invalidate,
    }),
    deleteSource: useMutation({
      mutationFn: (sourceId: string) => deleteAppStoreSource(sourceId),
      onSuccess: invalidate,
    }),
    updateTrust: useMutation({
      mutationFn: updateAppStoreTrust,
      onSuccess: invalidate,
    }),
    createKey: useMutation({
      mutationFn: createAppStoreTrustKey,
      onSuccess: invalidate,
    }),
    deleteKey: useMutation({
      mutationFn: (keyId: string) => deleteAppStoreTrustKey(keyId),
      onSuccess: invalidate,
    }),
  };
}

export type { AppStoreSource };
