export type CustomerStatus = "active" | "trial" | "archived";

export type ApplicationStatus = "design" | "ready" | "degraded";

export type AppResourceKind =
  | "vip"
  | "instance"
  | "certificate"
  | "dns"
  | "pool"
  | "note";

export type AppResource = {
  id: string;
  kind: AppResourceKind;
  name: string;
  detail: string;
  /** Illustrative link into real UI when applicable */
  href?: string;
  site?: string;
};

export type ApplicationSite = {
  id: string;
  name: string;
  location: string;
  role: string;
};

export type Application = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  status: ApplicationStatus;
  /** Catalog item slug for blueprint/integration deep-link */
  catalogItemSlug?: string;
  catalogKindHint?: "blueprint" | "integration" | "stack";
  sites?: ApplicationSite[];
  resources: AppResource[];
  notes?: string[];
};

export type Customer = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  status: CustomerStatus;
  applications: Application[];
};
