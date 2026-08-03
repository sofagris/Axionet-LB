import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLoadBalancer,
  createPlacementDomain,
  createSite,
  deleteLoadBalancer,
  deletePlacementDomain,
  deleteSite,
  fetchLoadBalancers,
  fetchPlacementDomains,
  fetchSites,
  updateLoadBalancer,
  updatePlacementDomain,
  updateSite,
} from "../../api/inventory";
import type {
  LoadBalancerCreatePayload,
  LoadBalancerUpdatePayload,
  PlacementDomainCreatePayload,
  PlacementDomainUpdatePayload,
  SiteCreatePayload,
  SiteUpdatePayload,
} from "../../types/inventory";

const sitesKey = ["sites"] as const;
const domainsKey = ["placement-domains"] as const;
const lbsKey = ["load-balancers"] as const;

export function useSites() {
  return useQuery({ queryKey: sitesKey, queryFn: fetchSites });
}

export function usePlacementDomains() {
  return useQuery({ queryKey: domainsKey, queryFn: fetchPlacementDomains });
}

export function useLoadBalancers() {
  return useQuery({ queryKey: lbsKey, queryFn: fetchLoadBalancers });
}

export function useInventoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: sitesKey }),
      queryClient.invalidateQueries({ queryKey: domainsKey }),
      queryClient.invalidateQueries({ queryKey: lbsKey }),
    ]);
  };

  return {
    createSite: useMutation({
      mutationFn: (payload: SiteCreatePayload) => createSite(payload),
      onSuccess: invalidate,
    }),
    updateSite: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: SiteUpdatePayload }) =>
        updateSite(id, payload),
      onSuccess: invalidate,
    }),
    deleteSite: useMutation({
      mutationFn: (id: string) => deleteSite(id),
      onSuccess: invalidate,
    }),
    createPlacementDomain: useMutation({
      mutationFn: (payload: PlacementDomainCreatePayload) => createPlacementDomain(payload),
      onSuccess: invalidate,
    }),
    updatePlacementDomain: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: PlacementDomainUpdatePayload }) =>
        updatePlacementDomain(id, payload),
      onSuccess: invalidate,
    }),
    deletePlacementDomain: useMutation({
      mutationFn: (id: string) => deletePlacementDomain(id),
      onSuccess: invalidate,
    }),
    createLoadBalancer: useMutation({
      mutationFn: (payload: LoadBalancerCreatePayload) => createLoadBalancer(payload),
      onSuccess: invalidate,
    }),
    updateLoadBalancer: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: LoadBalancerUpdatePayload }) =>
        updateLoadBalancer(id, payload),
      onSuccess: invalidate,
    }),
    deleteLoadBalancer: useMutation({
      mutationFn: (id: string) => deleteLoadBalancer(id),
      onSuccess: invalidate,
    }),
  };
}
