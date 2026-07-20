import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchSystemInfo, fetchSystemMetrics } from "../../api/system";

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

export function useSystemMetrics() {
  return useQuery({
    queryKey: ["system", "metrics"],
    queryFn: fetchSystemMetrics,
    refetchInterval: 5_000,
  });
}
