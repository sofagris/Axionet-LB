import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchSystemInfo } from "../../api/system";

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system", "health"],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system", "info"],
    queryFn: fetchSystemInfo,
  });
}
