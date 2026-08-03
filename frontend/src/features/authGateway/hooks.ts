import { useQuery } from "@tanstack/react-query";
import { fetchAuthGatewayOverview } from "../../api/authGateway";

export function useAuthGatewayOverview(instanceId: string) {
  return useQuery({
    queryKey: ["auth-gateway", instanceId, "overview"],
    queryFn: () => fetchAuthGatewayOverview(instanceId),
    enabled: Boolean(instanceId),
  });
}
