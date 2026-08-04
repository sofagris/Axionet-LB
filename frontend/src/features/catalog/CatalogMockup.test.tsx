import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { App } from "../../App";
import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { TenancyProvider } from "../tenancy/TenancyProvider";
import { CATALOG_ITEMS } from "./catalogData";
import "../../i18n";

vi.mock("../../api/serviceDefinitions", () => ({
  fetchServiceDefinitions: vi.fn(async () => [
    {
      service_type: "haproxy",
      display_name: "HAProxy",
      description: "TCP/HTTP load balancer",
      container_image: "haproxy",
      default_version: "3.2.6",
      enabled: true,
      supported_actions: ["start"],
    },
    {
      service_type: "frr",
      display_name: "FRR",
      description: "BGP",
      container_image: "axionet/frr",
      default_version: "10.2.6",
      enabled: true,
      supported_actions: ["start"],
    },
    {
      service_type: "varnish",
      display_name: "Varnish",
      description: "Coming soon",
      container_image: "varnish",
      default_version: "7.6",
      enabled: false,
      supported_actions: [],
    },
  ]),
  fetchServiceDefinition: vi.fn(),
}));

vi.mock("../../api/appPackages", () => ({
  fetchAppPackageCatalog: vi.fn(async () => []),
  fetchAppPackages: vi.fn(async () => []),
  fetchDesignerManifests: vi.fn(async () => []),
}));

vi.mock("../../api/networks", () => ({
  fetchNetworks: vi.fn(async () => []),
  createNetwork: vi.fn(),
  deleteNetwork: vi.fn(),
  validateNetwork: vi.fn(),
}));

vi.mock("../../api/instances", () => ({
  fetchInstances: vi.fn(async () => []),
  createInstance: vi.fn(),
  validateInstanceConfig: vi.fn(async () => ({
    ok: true,
    output: "Configuration file is valid",
    rendered_preview: "frontend main\n  bind *:80\n",
  })),
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
  restartInstance: vi.fn(),
  deleteInstance: vi.fn(),
  fetchInstanceLogs: vi.fn(async () => ({
    id: "inst-1",
    logs: "haproxy started\n",
  })),
}));

vi.mock("../../api/system", () => ({
  fetchHealth: vi.fn(async () => ({
    status: "ok",
    service: "ax-api",
    version: "0.1.0",
    checked_at: "2026-07-20T16:00:00Z",
    components: {
      api: { status: "ok", detail: "ok" },
      database: { status: "ok", detail: "ok", latency_ms: 1 },
      docker: { status: "ok", detail: "ok", latency_ms: 1 },
    },
  })),
  fetchSystemInfo: vi.fn(async () => ({
    name: "AxioNet LB",
    version: "0.1.0",
    api_prefix: "/api/v1",
    data_dir: "/var/lib/ax-lb",
    database_configured: true,
    docker_configured: true,
    management_interface: null,
    management_bind_ip: null,
  })),
  fetchCapabilities: vi.fn(async () => ({
    features: ["system.health"],
    dataplane_services: ["haproxy"],
  })),
  fetchSystemLogs: vi.fn(async () => ({
    events: [],
    instances: [],
    collected_at: "2026-07-20T16:00:00Z",
    errors: [],
  })),
  fetchAuditEvents: vi.fn(async () => ({ events: [], limit: 50, offset: 0 })),
  fetchSystemMetrics: vi.fn(),
  fetchLbMetrics: vi.fn(),
  fetchOrphans: vi.fn(async () => ({
    docker_ok: true,
    orphan_containers: [],
    orphan_networks: [],
    missing_containers: [],
    missing_networks: [],
    collected_at: "2026-07-20T16:00:00Z",
  })),
  pruneOrphans: vi.fn(),
}));

vi.mock("../../api/interfaces", () => ({
  fetchInterfaces: vi.fn(async () => []),
  rescanInterfaces: vi.fn(),
  updateInterface: vi.fn(),
  promoteManagement: vi.fn(),
  confirmInterfaceChange: vi.fn(),
}));

vi.mock("../../api/auth", () => ({
  fetchMe: vi.fn(async () => ({
    id: "user-1",
    username: "Admin",
    role: "admin",
    auth_source: "local",
    is_active: true,
    groups: [],
    effective_role: "admin",
    created_at: "2026-07-20T16:00:00Z",
  })),
  login: vi.fn(),
  logout: vi.fn(async () => undefined),
}));

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TenancyProvider>
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </MemoryRouter>
        </TenancyProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Catalog mockup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ax-lb-token", "test-token");
  });

  it("lists mock catalog items including PowerDNS and Cloudflare", async () => {
    renderAt("/catalog");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "HAProxy" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "PowerDNS Platform" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloudflare" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apache Guacamole" })).toBeInTheDocument();
    expect(screen.queryByText(/BIND/i)).not.toBeInTheDocument();
    expect(CATALOG_ITEMS.length).toBeGreaterThan(15);
  });

  it("filters by category providers", async () => {
    renderAt("/catalog?category=providers");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Cloudflare" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "HAProxy" })).not.toBeInTheDocument();
  });

  it("filters by kind stack", async () => {
    renderAt("/catalog?kind=stack");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "PowerDNS Platform" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "HAProxy" })).not.toBeInTheDocument();
  });

  it("search finds Guacamole", async () => {
    renderAt("/catalog?q=guacamole");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Apache Guacamole" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Cloudflare" })).not.toBeInTheDocument();
  });

  it("opens drawer from query and closes on Escape", async () => {
    renderAt("/catalog?item=cloudflare");
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Cloudflare" })).toBeInTheDocument();
    expect(within(drawer).getByText(/Cloudflare er ikke tilkoblet|Cloudflare is not connected/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("HAProxy primary action links to real create wizard", async () => {
    renderAt("/catalog");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "HAProxy" })).toBeInTheDocument();
    });
    const createLinks = screen.getAllByRole("link", { name: /Opprett instans|Create instance/i });
    expect(createLinks.some((link) => link.getAttribute("href") === "/instances/new?type=haproxy")).toBe(
      true,
    );
  });

  it("mock primary action opens design preview dialog", async () => {
    renderAt("/catalog?item=guacamole");
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    const drawer = screen.getByRole("dialog");
    fireEvent.click(within(drawer).getByRole("button", { name: /Start veiviser|Start wizard/i }));
    await waitFor(() => {
      expect(screen.getByText(/Design preview/i)).toBeInTheDocument();
    });
  });
});

describe("Front panel settings mockup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ax-lb-token", "test-token");
  });

  it("shows LCD section with experimental EEPROM and no write button there", async () => {
    renderAt("/settings?tab=front-panel");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Front panel \/ LCD|Frontpanel \/ LCD/i })).toBeInTheDocument();
    });
    expect(screen.getByText("/dev/ttyUSB0")).toBeInTheDocument();
    expect(screen.getByText(/Experimental \/ not implemented|Eksperimentelt \/ ikke implementert/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Write to EEPROM|Skriv til EEPROM/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Read capability|Les capability/i })).toBeInTheDocument();
  });
});
