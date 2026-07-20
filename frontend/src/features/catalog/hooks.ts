import { useQuery } from "@tanstack/react-query";
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
