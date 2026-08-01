import type { Application, Customer } from "./customerTypes";

export const CUSTOMERS: Customer[] = [
  {
    id: "kunde-a",
    slug: "kunde-a",
    name: "Kunde A",
    summary: "Tjenestetilbyder-kunde med geo-redundant webplattform på to lokasjoner.",
    status: "active",
    applications: [
      {
        id: "app-web",
        slug: "app-web",
        name: "Web-plattform",
        summary:
          "Samme tjeneste bak VIP på to sites. ~50 backend-servere per lokasjon — members i pools, ikke egne AxioNet-instanser.",
        status: "design",
        catalogItemSlug: "geo-redundant-lb",
        catalogKindHint: "blueprint",
        sites: [
          {
            id: "site-osl",
            name: "Site OSL",
            location: "Oslo",
            role: "Primary",
          },
          {
            id: "site-bgo",
            name: "Site BGO",
            location: "Bergen",
            role: "Secondary",
          },
        ],
        resources: [
          {
            id: "vip-web",
            kind: "vip",
            name: "VIP anycast",
            detail: "203.0.113.40/32 · announced via BGP on both sites",
          },
          {
            id: "hap-osl",
            kind: "instance",
            name: "HAProxy OSL",
            detail: "Dataplane instance (illustrative) · site OSL",
            site: "Site OSL",
            href: "/instances",
          },
          {
            id: "hap-bgo",
            kind: "instance",
            name: "HAProxy BGO",
            detail: "Dataplane instance (illustrative) · site BGO",
            site: "Site BGO",
            href: "/instances",
          },
          {
            id: "frr-osl",
            kind: "instance",
            name: "FRR OSL",
            detail: "BGP advertisement · withdraw on health failure",
            site: "Site OSL",
            href: "/instances",
          },
          {
            id: "frr-bgo",
            kind: "instance",
            name: "FRR BGO",
            detail: "BGP advertisement · withdraw on health failure",
            site: "Site BGO",
            href: "/instances",
          },
          {
            id: "pool-osl",
            kind: "pool",
            name: "Backend pool OSL",
            detail: "50 members · same service",
            site: "Site OSL",
          },
          {
            id: "pool-bgo",
            kind: "pool",
            name: "Backend pool BGO",
            detail: "50 members · same service",
            site: "Site BGO",
          },
          {
            id: "note-geo",
            kind: "note",
            name: "Geo model",
            detail:
              "One application, two dataplane nodes. Servers are pool members — not 100 separate customers or instances.",
          },
        ],
        notes: [
          "Blueprint: Geo-redundant Load Balancer (catalog mockup).",
          "Optional: PowerDNS or Cloudflare for DNS steering — not wired in this preview.",
        ],
      },
    ],
  },
  {
    id: "kunde-b",
    slug: "kunde-b",
    name: "Kunde B",
    summary: "Horizon / UAG lastbalansering med automatisk sertifikathåndtering.",
    status: "active",
    applications: [
      {
        id: "horizon",
        slug: "horizon",
        name: "Omnissa Horizon",
        summary:
          "Ekstern VIP mot HAProxy og fire UAG-er for webgrensesnitt og BLAST. AxioNet installerer ikke hele Horizon-plattformen.",
        status: "design",
        catalogItemSlug: "horizon-uag",
        catalogKindHint: "integration",
        resources: [
          {
            id: "vip-hz",
            kind: "vip",
            name: "Horizon VIP",
            detail: "203.0.113.55 · HTTPS / BLAST front door",
          },
          {
            id: "hap-hz",
            kind: "instance",
            name: "HAProxy Horizon",
            detail: "Dedicated instance recommended · persistence + multi-port",
            href: "/instances",
          },
          {
            id: "pool-uag",
            kind: "pool",
            name: "UAG pool",
            detail: "4 members · web UI + BLAST backends",
          },
          {
            id: "cert-hz",
            kind: "certificate",
            name: "TLS certificate",
            detail: "ACME via PKI / ACME (step-ca) · auto-renewal (design preview)",
          },
          {
            id: "note-blast",
            kind: "note",
            name: "Ports / protocols",
            detail:
              "HTTPS for portal; BLAST and related UAG service ports on the same VIP/frontend pattern — exact port matrix is integration config.",
          },
        ],
        notes: [
          "Integration: Omnissa Horizon UAG (catalog mockup).",
          "Certificate ownership belongs to this application, not a loose platform cert.",
        ],
      },
    ],
  },
];

export function listCustomers(): Customer[] {
  return CUSTOMERS;
}

export function getCustomer(customerId: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.id === customerId || c.slug === customerId);
}

export function getApplication(
  customerId: string,
  appId: string,
): { customer: Customer; application: Application } | undefined {
  const customer = getCustomer(customerId);
  if (!customer) return undefined;
  const application = customer.applications.find(
    (app) => app.id === appId || app.slug === appId,
  );
  if (!application) return undefined;
  return { customer, application };
}
