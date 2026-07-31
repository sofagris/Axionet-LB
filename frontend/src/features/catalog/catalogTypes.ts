export type CatalogItemKind =
  | "service"
  | "core-service"
  | "stack"
  | "blueprint"
  | "integration"
  | "provider";

export type CatalogCategory =
  | "traffic"
  | "core"
  | "security"
  | "observability"
  | "blueprints"
  | "providers";

export type CatalogStatus =
  | "available"
  | "planned"
  | "concept"
  | "connected"
  | "disconnected";

export type CatalogAction =
  | "create-instance"
  | "create-service"
  | "deploy-stack"
  | "start-wizard"
  | "configure-integration"
  | "connect-provider"
  | "manage-provider";

export type CatalogAccent =
  | "traffic"
  | "routing"
  | "core"
  | "security"
  | "observe"
  | "provider"
  | "blueprint";

export type CatalogBrand = {
  monogram: string;
  accent: CatalogAccent;
};

export type CatalogComponent = {
  id: string;
  name: string;
  role: string;
  required: boolean;
  implementation?: string;
  ports?: string[];
  healthCheck?: string;
};

export type CatalogFlowNode = {
  id: string;
  label: string;
  role: string;
};

export type CatalogFlowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  kind: CatalogItemKind;
  category: CatalogCategory;
  status: CatalogStatus;
  summary: string;
  description: string;
  version?: string;
  implementationHint?: string;
  image?: string;
  capabilities: string[];
  dependencies?: string[];
  components?: CatalogComponent[];
  requirements?: string[];
  tags: string[];
  primaryAction: CatalogAction;
  featured?: boolean;
  brand: CatalogBrand;
  /** When set, Create links to real `/instances/new?type=…` when deployable. */
  deployableServiceType?: string;
  notes?: string[];
  experimentalFlags?: string[];
  flowNodes?: CatalogFlowNode[];
  flowEdges?: CatalogFlowEdge[];
  /** Live overlay from API */
  apiEnabled?: boolean;
  connectionState?: "disconnected" | "connected";
};

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  "traffic",
  "core",
  "security",
  "observability",
  "blueprints",
  "providers",
];

export const CATALOG_KINDS: CatalogItemKind[] = [
  "service",
  "core-service",
  "stack",
  "blueprint",
  "integration",
  "provider",
];
