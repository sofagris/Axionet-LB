import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { App } from "../App";
import { ThemeProvider } from "../features/theme/ThemeProvider";
import "../i18n";

vi.mock("../api/serviceDefinitions", () => ({
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

vi.mock("../api/networks", () => ({
  fetchNetworks: vi.fn(async () => []),
  createNetwork: vi.fn(),
  deleteNetwork: vi.fn(),
  validateNetwork: vi.fn(),
}));

vi.mock("../api/instances", () => ({
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
  fetchInstanceLogs: vi.fn(),
}));

vi.mock("../api/system", () => ({
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
  fetchSystemMetrics: vi.fn(),
  fetchLbMetrics: vi.fn(),
}));

vi.mock("../api/interfaces", () => ({
  fetchInterfaces: vi.fn(async () => []),
  rescanInterfaces: vi.fn(),
  updateInterface: vi.fn(),
  promoteManagement: vi.fn(),
  confirmInterfaceChange: vi.fn(),
}));

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Service catalog and wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists catalog services", async () => {
    renderAt("/catalog");
    await waitFor(() => {
      expect(screen.getByText("HAProxy")).toBeInTheDocument();
    });
    expect(screen.getByText("Varnish")).toBeInTheDocument();
    expect(screen.getByText(/Opprett instans|Create instance/)).toBeInTheDocument();
  });

  it("advances wizard from type to name step", async () => {
    renderAt("/instances/new?type=haproxy");
    await waitFor(() => {
      expect(screen.getByText("HAProxy")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Neste|Next/ }));
    expect(screen.getByPlaceholderText("edge-haproxy-1")).toBeInTheDocument();
  });

  it("shows settings system info", async () => {
    renderAt("/settings");
    await waitFor(() => {
      expect(screen.getByText("/api/v1")).toBeInTheDocument();
    });
    expect(screen.getByText("/var/lib/ax-lb")).toBeInTheDocument();
  });
});
