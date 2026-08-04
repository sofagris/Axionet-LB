import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAppPackageCatalog,
  fetchAppStore,
  installAppPackage,
} from "../../api/appPackages";
import { fetchServiceDefinition, fetchServiceDefinitions } from "../../api/serviceDefinitions";

export function useServiceDefinitions() {
  return useQuery({
    queryKey: ["service-definitions"],
    queryFn: fetchServiceDefinitions,
  });
}

export function useServiceDefinition(serviceType: string | null) {
  return useQuery({
    queryKey: ["service-definitions", serviceType],
    queryFn: () => fetchServiceDefinition(serviceType!),
    enabled: Boolean(serviceType),
  });
}

export function useAppPackageCatalog(includeReference = false) {
  return useQuery({
    queryKey: ["app-packages", "catalog", includeReference],
    queryFn: () => fetchAppPackageCatalog({ includeReference }),
    staleTime: 60_000,
  });
}

export function useAppStore(includeReference = false) {
  return useQuery({
    queryKey: ["app-packages", "store", includeReference],
    queryFn: () => fetchAppStore({ includeReference }),
    staleTime: 30_000,
  });
}

export function useInstallAppPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { packageId?: string; archiveUrl?: string }) =>
      installAppPackage(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-packages"] }),
        queryClient.invalidateQueries({ queryKey: ["service-definitions"] }),
      ]);
    },
  });
}
