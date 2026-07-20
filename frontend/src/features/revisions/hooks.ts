import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRevision, fetchRevisions, restoreRevision } from "../../api/revisions";

export function useRevisions(instanceId: string) {
  return useQuery({
    queryKey: ["revisions", instanceId],
    queryFn: () => fetchRevisions(instanceId),
    enabled: Boolean(instanceId),
  });
}

export function useRevision(instanceId: string, revisionId: string | null) {
  return useQuery({
    queryKey: ["revisions", instanceId, revisionId],
    queryFn: () => fetchRevision(instanceId, revisionId as string),
    enabled: Boolean(instanceId && revisionId),
  });
}

export function useRestoreRevision(instanceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) => restoreRevision(instanceId, revisionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["revisions", instanceId] });
      await queryClient.invalidateQueries({ queryKey: ["haproxy", instanceId] });
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });
}
