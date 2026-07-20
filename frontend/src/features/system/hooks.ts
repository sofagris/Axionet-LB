import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAuditEvents,
  fetchCapabilities,
  fetchHealth,
  fetchLbMetrics,
  fetchOrphans,
  fetchSystemInfo,
  fetchSystemLogs,
  fetchSystemMetrics,
  pruneOrphans,
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

export function useAuditEvents(limit = 50) {
  return useQuery({
    queryKey: ["system", "audit", limit],
    queryFn: () => fetchAuditEvents({ limit }),
    refetchInterval: 10_000,
  });
}

export function useOrphans() {
  return useQuery({
    queryKey: ["system", "orphans"],
    queryFn: fetchOrphans,
  });
}

export function usePruneOrphans() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pruneOrphans,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system", "orphans"] });
      await queryClient.invalidateQueries({ queryKey: ["system", "audit"] });
    },
  });
}
