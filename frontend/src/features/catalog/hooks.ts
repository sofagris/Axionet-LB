import { useQuery } from "@tanstack/react-query";
import { fetchAppPackageCatalog } from "../../api/appPackages";
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
