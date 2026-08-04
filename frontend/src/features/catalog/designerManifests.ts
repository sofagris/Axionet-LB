/**
 * Declarative Designer contract for a Catalog deployable service.
 * Canvas code should read manifests; live hydrate/sync stays in adapters.
 *
 * @see docs/ADR-designer-catalog-extensibility.md
 */

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

export type DesignerPropField = {
  key: string;
  labelKey: string;
  placeholder?: string;
  /** Initial value when the component is dropped onto the canvas. */
  default?: string;
};

export type DesignerRoleSchema = {
  props: DesignerPropField[];
};

export type DesignerManifest = {
  catalogId: string;
  serviceType: string;
  components: DesignerComponentDef[];
  chain: DesignerServiceTree["chain"];
  /** Prop schemas keyed by component role (shared across components with that role). */
  roles: Record<string, DesignerRoleSchema>;
  /**
   * Future: none | onDrop | poll — only "haproxy" uses a code adapter today.
   * Kept here so App Store packages can declare intent without canvas branches.
   */
  hydrate?: "none" | "onDrop" | "poll";
};

function role(
  props: Array<[key: string, labelKey: string, placeholder?: string, defaultValue?: string]>,
): DesignerRoleSchema {
  return {
    props: props.map(([key, labelKey, placeholder, defaultValue]) => ({
      key,
      labelKey,
      placeholder,
      default: defaultValue,
    })),
  };
}

/** Single source for Designer trees + editable props (step 1 of App Store readiness). */
export const DESIGNER_MANIFESTS: DesignerManifest[] = [
  {
    catalogId: "haproxy",
    serviceType: "haproxy",
    hydrate: "poll",
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
    roles: {
      frontend: role([
        ["name", "designer.props.name", "fe_http", "fe_http"],
        ["bind", "designer.props.bind", "*:443", "*:443"],
        ["mode", "designer.props.mode", "http", "http"],
        ["default_backend", "designer.props.defaultBackend", "be_app", ""],
        ["certificate", "designer.props.certificate", "site", ""],
      ]),
      backend: role([
        ["name", "designer.props.name", "be_app", "be_app"],
        ["balance", "designer.props.balance", "roundrobin", "roundrobin"],
        ["mode", "designer.props.mode", "http", "http"],
      ]),
      server: role([
        ["name", "designer.props.name", "s1", "s1"],
        ["address", "designer.props.address", "10.0.0.10", ""],
        ["port", "designer.props.port", "80", "80"],
        ["check", "designer.props.check", "enabled", "enabled"],
        ["weight", "designer.props.weight", "100", "100"],
        ["backend", "designer.props.backend", "be_app", ""],
      ]),
      "error-page": role([
        ["name", "designer.props.name", "not-found", "not-found"],
        ["status_code", "designer.props.statusCode", "404", "404"],
        ["title", "designer.props.errorTitle", "Not Found", "Not Found"],
        ["frontend", "designer.props.errorFrontend", "", ""],
      ]),
    },
  },
  {
    catalogId: "frr",
    serviceType: "frr",
    hydrate: "none",
    components: [
      { id: "peer", label: "BGP peer", role: "external" },
      { id: "daemon", label: "FRR daemon", role: "service" },
      { id: "routes", label: "VIP routes", role: "routes" },
    ],
    chain: [
      { from: "peer", to: "daemon", label: "BGP" },
      { from: "daemon", to: "routes", label: "advertise" },
    ],
    roles: {
      external: role([
        ["peer_ip", "designer.props.peerIp"],
        ["asn", "designer.props.asn"],
      ]),
      service: role([["router_id", "designer.props.routerId"]]),
      routes: role([["prefix", "designer.props.prefix"]]),
    },
  },
  {
    catalogId: "auth-gateway",
    serviceType: "auth-gateway",
    hydrate: "none",
    components: [
      { id: "listen", label: "Listen :4180", role: "listen" },
      { id: "oidc", label: "OIDC", role: "oidc" },
      { id: "upstream", label: "Upstream", role: "upstream" },
    ],
    chain: [
      { from: "listen", to: "oidc", label: "auth" },
      { from: "oidc", to: "upstream", label: "proxy" },
    ],
    roles: {
      listen: role([["listen", "designer.props.listen", "0.0.0.0:4180", "0.0.0.0:4180"]]),
      oidc: role([
        ["issuer_url", "designer.props.issuerUrl"],
        ["client_id", "designer.props.clientId"],
        ["redirect_url", "designer.props.redirectUrl"],
      ]),
      upstream: role([["upstream_url", "designer.props.upstreamUrl"]]),
    },
  },
  {
    catalogId: "keycloak-mgmt",
    serviceType: "keycloak-mgmt",
    hydrate: "none",
    components: [
      { id: "realm", label: "Realm", role: "realm" },
      { id: "clients", label: "Clients", role: "clients" },
      { id: "users", label: "Users / groups", role: "users" },
    ],
    chain: [
      { from: "realm", to: "clients", label: "contains" },
      { from: "realm", to: "users", label: "contains" },
    ],
    roles: {
      realm: role([["realm", "designer.props.realm"]]),
      clients: role([["client_id", "designer.props.clientId"]]),
      users: role([["group", "designer.props.group"]]),
    },
  },
  {
    catalogId: "keycloak-apps",
    serviceType: "keycloak-apps",
    hydrate: "none",
    components: [
      { id: "realm", label: "Realm", role: "realm" },
      { id: "clients", label: "Clients", role: "clients" },
      { id: "users", label: "Users / groups", role: "users" },
    ],
    chain: [
      { from: "realm", to: "clients", label: "contains" },
      { from: "realm", to: "users", label: "contains" },
    ],
    roles: {
      realm: role([["realm", "designer.props.realm"]]),
      clients: role([["client_id", "designer.props.clientId"]]),
      users: role([["group", "designer.props.group"]]),
    },
  },
];

export function designerManifestByCatalogId(
  catalogId: string,
): DesignerManifest | undefined {
  return DESIGNER_MANIFESTS.find((m) => m.catalogId === catalogId);
}

export function designerManifestByServiceType(
  serviceType: string,
): DesignerManifest | undefined {
  return DESIGNER_MANIFESTS.find((m) => m.serviceType === serviceType);
}

/** First matching role schema across manifests (roles are unique by convention today). */
export function designerRoleSchema(role: string): DesignerRoleSchema | undefined {
  for (const manifest of DESIGNER_MANIFESTS) {
    const schema = manifest.roles[role];
    if (schema) return schema;
  }
  return undefined;
}

export function designerServiceTrees(): DesignerServiceTree[] {
  return DESIGNER_MANIFESTS.map(({ catalogId, serviceType, components, chain }) => ({
    catalogId,
    serviceType,
    components,
    chain,
  }));
}
