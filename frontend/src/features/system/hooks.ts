import { useQuery } from "@tanstack/react-query";
import {
  fetchCapabilities,
  fetchHealth,
  fetchLbMetrics,
  fetchSystemInfo,
  fetchSystemLogs,
  fetchSystemMetrics,
} from "../../api/system";

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

export function useCapabilities() {
  return useQuery({
    queryKey: ["system", "capabilities"],
    queryFn: fetchCapabilities,
  });
}

export function useSystemLogs() {
  return useQuery({
    queryKey: ["system", "logs"],
    queryFn: fetchSystemLogs,
    refetchInterval: 10_000,
  });
}
