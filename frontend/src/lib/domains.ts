export type UiDomain =
  | "traffic"
  | "routing"
  | "interfaces"
  | "security"
  | "observe"
  | "system";

/** Border / text / soft bg classes for domain accents (Tailwind theme colors). */
export const domainBorder: Record<UiDomain, string> = {
  traffic: "border-domain-traffic",
  routing: "border-domain-routing",
  interfaces: "border-domain-interfaces",
  security: "border-domain-security",
  observe: "border-domain-observe",
  system: "border-domain-system",
};

export const domainText: Record<UiDomain, string> = {
  traffic: "text-domain-traffic",
  routing: "text-domain-routing",
  interfaces: "text-domain-interfaces",
  security: "text-domain-security",
  observe: "text-domain-observe",
  system: "text-domain-system",
};

export const domainSoftBg: Record<UiDomain, string> = {
  traffic: "bg-domain-traffic-soft/70",
  routing: "bg-domain-routing-soft/70",
  interfaces: "bg-domain-interfaces-soft/70",
  security: "bg-domain-security-soft/70",
  observe: "bg-domain-observe-soft/70",
  system: "bg-domain-system-soft/70",
};

export const domainFill: Record<UiDomain, string> = {
  traffic: "bg-domain-traffic",
  routing: "bg-domain-routing",
  interfaces: "bg-domain-interfaces",
  security: "bg-domain-security",
  observe: "bg-domain-observe",
  system: "bg-domain-system",
};

export const domainCssVar: Record<UiDomain, string> = {
  traffic: "var(--ax-domain-traffic)",
  routing: "var(--ax-domain-routing)",
  interfaces: "var(--ax-domain-interfaces)",
  security: "var(--ax-domain-security)",
  observe: "var(--ax-domain-observe)",
  system: "var(--ax-domain-system)",
};
