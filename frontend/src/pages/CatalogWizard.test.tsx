import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../features/auth/AuthProvider";
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
  fetchInstanceLogs: vi.fn(async () => ({
    id: "inst-1",
    logs: "haproxy started\n",
  })),
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
  fetchSystemLogs: vi.fn(async () => ({
    errors: [],
    instances: [
      {
        instance_id: "inst-1",
        name: "edge-1",
        service_type: "haproxy",
        actual_state: "running",
        health_status: "healthy",
        has_error: false,
        container_name: "ax-haproxy-1",
      },
    ],
    collected_at: "2026-07-20T16:00:00Z",
  })),
  fetchAuditEvents: vi.fn(async () => ({
    events: [],
    limit: 50,
    offset: 0,
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

vi.mock("../api/auth", () => ({
  fetchMe: vi.fn(async () => ({
    id: "user-1",
    username: "Admin",
    role: "admin",
    is_active: true,
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
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Service catalog and wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ax-lb-token", "test-token");
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

  it("shows system logs page", async () => {
    renderAt("/logs");
    await waitFor(() => {
      expect(screen.getByText("edge-1")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/haproxy started/)).toBeInTheDocument();
    });
  });
});
