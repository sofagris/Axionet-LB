import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { App } from "../App";
import { ThemeProvider } from "../features/theme/ThemeProvider";
import "../i18n";

vi.mock("../api/system", () => ({
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
  })),
  fetchSystemMetrics: vi.fn(async () => ({
    cpu_percent: 12.5,
    mem_total_bytes: 16 * 1024 ** 3,
    mem_available_bytes: 8 * 1024 ** 3,
    mem_used_percent: 50,
    load_avg_1: 0.4,
    load_avg_5: 0.3,
    load_avg_15: 0.2,
    collected_at: "2026-07-20T16:00:00Z",
  })),
}));

vi.mock("../api/interfaces", () => ({
  fetchInterfaces: vi.fn(async () => [
    {
      id: "1",
      name: "eth0",
      mac_address: "aa:bb:cc:dd:ee:ff",
      pci_address: "0000:01:00.0",
      numa_node: 0,
      speed_mbps: 10000,
      driver: "ixgbe",
      description: null,
      mtu: 1500,
      link_state: "up",
      administrative_state: "enabled",
      exclusive_use: false,
      discovered_at: "2026-07-20T16:00:00Z",
      updated_at: "2026-07-20T16:00:00Z",
    },
  ]),
  rescanInterfaces: vi.fn(),
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
  startInstance: vi.fn(),
  stopInstance: vi.fn(),
  restartInstance: vi.fn(),
  deleteInstance: vi.fn(),
  fetchInstanceLogs: vi.fn(),
}));

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows brand and health status", async () => {
    renderApp();
    expect(screen.getAllByText("AxioNet").length).toBeGreaterThan(0);
    expect(screen.getByText("Load Balancer")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("System health")).toBeInTheDocument();
    });
    expect(screen.getAllByText("ok").length).toBeGreaterThan(0);
  });
});
