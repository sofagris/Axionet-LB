import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { App } from "../../App";
import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { TenancyProvider } from "../tenancy/TenancyProvider";
import "../../i18n";

vi.mock("../../api/serviceDefinitions", () => ({
  fetchServiceDefinitions: vi.fn(async () => []),
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
  validateInstanceConfig: vi.fn(),
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
  restartInstance: vi.fn(),
  deleteInstance: vi.fn(),
  fetchInstanceLogs: vi.fn(),
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
  fetchCapabilities: vi.fn(async () => ({ features: [], dataplane_services: [] })),
  fetchSystemLogs: vi.fn(async () => ({
    errors: [],
    instances: [],
    collected_at: "2026-07-20T16:00:00Z",
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

describe("Customers mockup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ax-lb-token", "test-token");
    localStorage.setItem("axionet-tenancy-mode", "customers");
  });

  it("lists Kunde A and Kunde B", async () => {
    renderAt("/customers");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Kunde A" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Kunde B" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kunder|Customers/i })).toBeInTheDocument();
  });

  it("hides customers nav when tenancy is off", async () => {
    localStorage.setItem("axionet-tenancy-mode", "off");
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Catalog/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /^Kunder$|^Customers$/i })).not.toBeInTheDocument();
  });

  it("shows service areas nav label in internal mode", async () => {
    localStorage.setItem("axionet-tenancy-mode", "internal");
    renderAt("/");
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Tjenesteområder|Service areas/i }),
      ).toBeInTheDocument();
    });
  });

  it("customer detail lists applications and links to app", async () => {
    renderAt("/customers/kunde-a");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Kunde A" })).toBeInTheDocument();
    });
    const appLink = screen.getByRole("link", { name: /Web-plattform/i });
    expect(appLink).toHaveAttribute("href", "/customers/kunde-a/apps/app-web");
  });

  it("geo application shows two sites", async () => {
    renderAt("/customers/kunde-a/apps/app-web");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Web-plattform" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Site OSL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Site BGO").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/50 members/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Horizon certificate resource and catalog link", async () => {
    renderAt("/customers/kunde-b/apps/horizon");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Omnissa Horizon" })).toBeInTheDocument();
    });
    expect(screen.getByText("TLS certificate")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "horizon-uag" })).toHaveAttribute(
      "href",
      "/catalog?item=horizon-uag",
    );
    expect(screen.getByRole("link", { name: "Kunde B" })).toHaveAttribute(
      "href",
      "/customers/kunde-b",
    );
  });
});
