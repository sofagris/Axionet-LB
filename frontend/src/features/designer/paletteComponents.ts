import type { CatalogBrand, CatalogStatus } from "../catalog/catalogTypes";

export type DesignerComponentDef = {
  id: string;
  label: string;
  role: string;
};

export type DesignerServiceTree = {
  /** Catalog item id / slug key */
  catalogId: string;
  serviceType?: string;
  components: DesignerComponentDef[];
  /** Ordered edges between component ids (not including parent). */
  chain: Array<{ from: string; to: string; label?: string }>;
};

/** Services that expose expandable component palettes in Designer. */
export const DESIGNER_SERVICE_TREES: DesignerServiceTree[] = [
  {
    catalogId: "haproxy",
    serviceType: "haproxy",
    components: [
      { id: "frontend", label: "Frontend", role: "frontend" },
      { id: "backend", label: "Backend", role: "backend" },
      { id: "server", label: "Server", role: "server" },
      { id: "error-page", label: "Error page", role: "error-page" },
    ],
    chain: [
      { from: "frontend", to: "backend", label: "use_backend" },
      { from: "backend", to: "server", label: "server" },
      { from: "frontend", to: "error-page", label: "errorfile" },
    ],
  },
  {
    catalogId: "frr",
    serviceType: "frr",
    components: [
      { id: "peer", label: "BGP peer", role: "external" },
      { id: "daemon", label: "FRR daemon", role: "service" },
      { id: "routes", label: "VIP routes", role: "routes" },
    ],
    chain: [
      { from: "peer", to: "daemon", label: "BGP" },
      { from: "daemon", to: "routes", label: "advertise" },
    ],
  },
  {
    catalogId: "auth-gateway",
    serviceType: "auth-gateway",
    components: [
      { id: "listen", label: "Listen :4180", role: "listen" },
      { id: "oidc", label: "OIDC", role: "oidc" },
      { id: "upstream", label: "Upstream", role: "upstream" },
    ],
    chain: [
      { from: "listen", to: "oidc", label: "auth" },
      { from: "oidc", to: "upstream", label: "proxy" },
    ],
  },
  {
    catalogId: "keycloak-mgmt",
    serviceType: "keycloak-mgmt",
    components: [
      { id: "realm", label: "Realm", role: "realm" },
      { id: "clients", label: "Clients", role: "clients" },
      { id: "users", label: "Users / groups", role: "users" },
    ],
    chain: [
      { from: "realm", to: "clients", label: "contains" },
      { from: "realm", to: "users", label: "contains" },
    ],
  },
  {
    catalogId: "keycloak-apps",
    serviceType: "keycloak-apps",
    components: [
      { id: "realm", label: "Realm", role: "realm" },
      { id: "clients", label: "Clients", role: "clients" },
      { id: "users", label: "Users / groups", role: "users" },
    ],
    chain: [
      { from: "realm", to: "clients", label: "contains" },
      { from: "realm", to: "users", label: "contains" },
    ],
  },
];

export function serviceTreeByCatalogId(catalogId: string): DesignerServiceTree | undefined {
  return DESIGNER_SERVICE_TREES.find((t) => t.catalogId === catalogId);
}

export function serviceTreeByServiceType(serviceType: string): DesignerServiceTree | undefined {
  return DESIGNER_SERVICE_TREES.find((t) => t.serviceType === serviceType);
}

export type CatalogDropMeta = {
  catalogId: string;
  catalogSlug: string;
  label: string;
  serviceType?: string;
  catalogStatus: CatalogStatus;
  brand: CatalogBrand;
  comingSoon: boolean;
};
