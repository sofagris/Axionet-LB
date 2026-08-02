import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchKeycloakOverview, wireKeycloakPlatformOidc } from "../../api/keycloak";

export function useKeycloakOverview(instanceId: string) {
  return useQuery({
    queryKey: ["keycloak", instanceId, "overview"],
    queryFn: () => fetchKeycloakOverview(instanceId),
    enabled: Boolean(instanceId),
  });
}

export function useWireKeycloakPlatformOidc(instanceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { source_name?: string; upn_suffix?: string }) =>
      wireKeycloakPlatformOidc(instanceId, body ?? {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["keycloak", instanceId] });
      await queryClient.invalidateQueries({ queryKey: ["auth-sources"] });
    },
  });
}
