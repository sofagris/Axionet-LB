import type { CatalogAccent } from "./catalogTypes";

export const accentBorder: Record<CatalogAccent, string> = {
  traffic: "border-domain-traffic",
  routing: "border-domain-routing",
  core: "border-catalog-core",
  security: "border-domain-security",
  observe: "border-domain-observe",
  provider: "border-catalog-provider",
  blueprint: "border-catalog-blueprint",
};

export const accentText: Record<CatalogAccent, string> = {
  traffic: "text-domain-traffic",
  routing: "text-domain-routing",
  core: "text-catalog-core",
  security: "text-domain-security",
  observe: "text-domain-observe",
  provider: "text-catalog-provider",
  blueprint: "text-catalog-blueprint",
};

export const accentSoftBg: Record<CatalogAccent, string> = {
  traffic: "bg-domain-traffic-soft/70",
  routing: "bg-domain-routing-soft/70",
  core: "bg-catalog-core-soft/70",
  security: "bg-domain-security-soft/70",
  observe: "bg-domain-observe-soft/70",
  provider: "bg-catalog-provider-soft/70",
  blueprint: "bg-catalog-blueprint-soft/70",
};

export const accentBar: Record<CatalogAccent, string> = {
  traffic: "bg-domain-traffic",
  routing: "bg-domain-routing",
  core: "bg-catalog-core",
  security: "bg-domain-security",
  observe: "bg-domain-observe",
  provider: "bg-catalog-provider",
  blueprint: "bg-catalog-blueprint",
};
