import { z } from "zod";
import { apiFetch } from "./client";
import {
  LoadBalancerSchema,
  PlacementDomainSchema,
  SiteSchema,
  type LoadBalancer,
  type LoadBalancerCreatePayload,
  type LoadBalancerUpdatePayload,
  type PlacementDomainCreatePayload,
  type PlacementDomainRecord,
  type PlacementDomainUpdatePayload,
  type Site,
  type SiteCreatePayload,
  type SiteUpdatePayload,
} from "../types/inventory";

export function fetchSites(): Promise<Site[]> {
  return apiFetch("/api/v1/sites", (data) => z.array(SiteSchema).parse(data));
}

export function createSite(payload: SiteCreatePayload): Promise<Site> {
  return apiFetch("/api/v1/sites", (data) => SiteSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateSite(id: string, payload: SiteUpdatePayload): Promise<Site> {
  return apiFetch(`/api/v1/sites/${id}`, (data) => SiteSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteSite(id: string): Promise<void> {
  return apiFetch(`/api/v1/sites/${id}`, () => undefined, { method: "DELETE" });
}

export function fetchPlacementDomains(): Promise<PlacementDomainRecord[]> {
  return apiFetch("/api/v1/placement-domains", (data) =>
    z.array(PlacementDomainSchema).parse(data),
  );
}

export function createPlacementDomain(
  payload: PlacementDomainCreatePayload,
): Promise<PlacementDomainRecord> {
  return apiFetch("/api/v1/placement-domains", (data) => PlacementDomainSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updatePlacementDomain(
  id: string,
  payload: PlacementDomainUpdatePayload,
): Promise<PlacementDomainRecord> {
  return apiFetch(`/api/v1/placement-domains/${id}`, (data) => PlacementDomainSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deletePlacementDomain(id: string): Promise<void> {
  return apiFetch(`/api/v1/placement-domains/${id}`, () => undefined, { method: "DELETE" });
}

export function fetchLoadBalancers(): Promise<LoadBalancer[]> {
  return apiFetch("/api/v1/load-balancers", (data) => z.array(LoadBalancerSchema).parse(data));
}

export function createLoadBalancer(payload: LoadBalancerCreatePayload): Promise<LoadBalancer> {
  return apiFetch("/api/v1/load-balancers", (data) => LoadBalancerSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateLoadBalancer(
  id: string,
  payload: LoadBalancerUpdatePayload,
): Promise<LoadBalancer> {
  return apiFetch(`/api/v1/load-balancers/${id}`, (data) => LoadBalancerSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteLoadBalancer(id: string): Promise<void> {
  return apiFetch(`/api/v1/load-balancers/${id}`, () => undefined, { method: "DELETE" });
}
