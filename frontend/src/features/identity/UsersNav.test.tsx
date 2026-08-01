import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import * as authApi from "../../api/auth";
import { AuthProvider } from "../auth/AuthProvider";
import { TenancyProvider } from "../tenancy/TenancyProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import "../../i18n";

vi.mock("../../api/system", () => ({
  fetchHealth: vi.fn(async () => ({
    status: "ok",
    service: "ax-api",
    version: "0.1.0",
    checked_at: "2026-07-20T16:00:00Z",
    components: {
      api: { status: "ok", detail: "process running" },
      database: { status: "ok", detail: "sqlite reachable", latency_ms: 1.2 },
      docker: { status: "ok", detail: "engine reachable", latency_ms: 3.4 },
    },
  })),
  fetchSystemInfo: vi.fn(async () => ({
    name: "AxioNet LB",
    version: "0.1.0",
    api_prefix: "/api/v1",
    data_dir: "/var/lib/ax-lb",
    database_configured: true,
    docker_configured: true,
    management_interface: "eth0",
    management_bind_ip: "192.168.50.195",
  })),
  fetchCapabilities: vi.fn(async () => ({
    features: ["system.health"],
    dataplane_services: [],
  })),
  fetchSystemLogs: vi.fn(async () => ({
    errors: [],
    instances: [],
    collected_at: "2026-07-20T16:00:00Z",
  })),
  fetchAuditEvents: vi.fn(async () => ({ events: [], limit: 50, offset: 0 })),
  fetchSystemMetrics: vi.fn(async () => ({
    cpu_percent: 1,
    mem_total_bytes: 1,
    mem_available_bytes: 1,
    mem_used_percent: 1,
    load_avg_1: 0,
    load_avg_5: 0,
    load_avg_15: 0,
    network: {
      rx_bytes: 0,
      tx_bytes: 0,
      rx_packets: 0,
      tx_packets: 0,
      rx_errors: 0,
      tx_errors: 0,
      rx_dropped: 0,
      tx_dropped: 0,
    },
    interfaces: [],
    collected_at: "2026-07-20T16:00:00Z",
  })),
  fetchLbMetrics: vi.fn(async () => ({
    totals: {
      current_sessions: 0,
      total_sessions: 0,
      session_rate: 0,
      bytes_in: 0,
      bytes_out: 0,
      request_errors: 0,
      connection_errors: 0,
      response_errors: 0,
      servers_up: 0,
      servers_down: 0,
      servers_total: 0,
      instances_available: 0,
      instances_total: 0,
    },
    instances: [],
    collected_at: "2026-07-20T16:00:00Z",
  })),
}));

vi.mock("../../api/interfaces", () => ({
  fetchInterfaces: vi.fn(async () => []),
  rescanInterfaces: vi.fn(),
  updateInterface: vi.fn(),
  promoteManagement: vi.fn(),
  confirmInterfaceChange: vi.fn(),
}));

vi.mock("../../api/networks", () => ({
  fetchNetworks: vi.fn(async () => []),
  createNetwork: vi.fn(),
  deleteNetwork: vi.fn(),
  validateNetwork: vi.fn(),
}));

vi.mock("../../api/vips", () => ({
  fetchVips: vi.fn(async () => []),
  createVip: vi.fn(),
  enableVip: vi.fn(),
  disableVip: vi.fn(),
  deleteVip: vi.fn(),
}));

vi.mock("../../api/instances", () => ({
  fetchInstances: vi.fn(async () => []),
  createInstance: vi.fn(),
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
  restartInstance: vi.fn(),
  deleteInstance: vi.fn(),
  fetchInstanceLogs: vi.fn(),
}));

vi.mock("../../api/auth", () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(async () => undefined),
}));

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TenancyProvider>
          <MemoryRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </MemoryRouter>
        </TenancyProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Users nav visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ax-lb-token", "test-token");
  });

  it("shows Users for admin effective_role", async () => {
    vi.mocked(authApi.fetchMe).mockResolvedValue({
      id: "user-1",
      username: "Admin",
      role: "admin",
      auth_source: "local",
      is_active: true,
      groups: [],
      effective_role: "admin",
      created_at: "2026-07-20T16:00:00Z",
    });
    renderApp();
    expect(await screen.findAllByRole("link", { name: /^brukere$|^users$/i })).not.toHaveLength(0);
  });

  it("hides Users for non-admin", async () => {
    vi.mocked(authApi.fetchMe).mockResolvedValue({
      id: "user-2",
      username: "viewer",
      role: "viewer",
      auth_source: "local",
      is_active: true,
      groups: [],
      effective_role: "viewer",
      created_at: "2026-07-20T16:00:00Z",
    });
    renderApp();
    await screen.findByRole("link", { name: /^dashboard$/i });
    expect(screen.queryByRole("link", { name: /^brukere$|^users$/i })).toBeNull();
  });
});
