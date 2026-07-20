import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchLbMetrics, fetchSystemInfo, fetchSystemMetrics } from "../../api/system";

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

export function useLbMetrics() {
  return useQuery({
    queryKey: ["system", "lb-metrics"],
    queryFn: fetchLbMetrics,
    refetchInterval: 5_000,
  });
}
