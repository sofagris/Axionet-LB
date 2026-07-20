import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInterfaces, rescanInterfaces } from "../../api/interfaces";

export function useInterfaces() {
  return useQuery({
    queryKey: ["interfaces"],
    queryFn: fetchInterfaces,
    refetchInterval: 15_000,
  });
}

export function useRescanInterfaces() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rescanInterfaces,
    onSuccess: (data) => {
      queryClient.setQueryData(["interfaces"], data.interfaces);
    },
  });
}
