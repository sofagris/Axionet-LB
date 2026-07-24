import { describe, expect, it } from "vitest";
import { buildFlowSlides, haproxyAttachmentIp } from "./buildFlowSlides";
import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";

const haproxy: Instance = {
  id: "hap-1",
  name: "edge-1",
  service_type: "haproxy",
  desired_state: "running",
  actual_state: "running",
  image: "haproxy:3.2.6",
  image_version: "3.2.6",
  restart_policy: "unless-stopped",
  configuration: {},
  container_id: "c1",
  container_name: "ax-haproxy",
  last_error: null,
  health_status: "healthy",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:00Z",
  stopped_at: null,
  networks: [
    {
      id: "att-1",
      network_id: "net-1",
      ip_address: "192.168.22.10",
      gateway: null,
      interface_alias: null,
      attachment_order: 0,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
};

const frr: Instance = {
  ...haproxy,
  id: "frr-1",
  name: "edge-sonic-a",
  service_type: "frr",
  networks: [
    {
      id: "att-2",
      network_id: "net-1",
      ip_address: "192.168.22.2",
      gateway: null,
      interface_alias: null,
      attachment_order: 0,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
};

const vip: Vip = {
  id: "vip-1",
  name: "vip-routed-10",
  address: "203.0.113.10",
  mode: "routed",
  backend_ip: "192.168.22.10",
  haproxy_instance_id: "hap-1",
  frr_instance_id: "frr-1",
  network_id: "net-1",
  enabled: true,
  advertise: true,
  attached: false,
  dataplane_ready: true,
  advertised: true,
  last_error: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  announce_prefix: "203.0.113.10/32",
  links: [],
};

describe("buildFlowSlides", () => {
  it("always starts with fleet and appends VIP slides", () => {
    const slides = buildFlowSlides({
      vips: [vip],
      instances: [haproxy, frr],
      lbMetrics: {
        totals: {
          current_sessions: 1,
          total_sessions: 10,
          session_rate: 2,
          bytes_in: 100,
          bytes_out: 200,
          request_errors: 0,
          connection_errors: 0,
          response_errors: 0,
          servers_up: 1,
          servers_down: 0,
          servers_total: 1,
          instances_available: 1,
          instances_total: 1,
        },
        instances: [
          {
            instance_id: "hap-1",
            name: "edge-1",
            available: true,
            current_sessions: 1,
            total_sessions: 10,
            session_rate: 2,
            bytes_in: 100,
            bytes_out: 200,
            request_errors: 0,
            connection_errors: 0,
            response_errors: 0,
            servers_up: 1,
            servers_down: 0,
            servers_total: 1,
            frontend_count: 1,
            backend_count: 1,
          },
        ],
        collected_at: "2026-01-01T00:00:00Z",
      },
    });

    expect(slides).toHaveLength(2);
    expect(slides[0].kind).toBe("fleet");
    expect(slides[1].kind).toBe("vip");
    expect(slides[1].title).toBe("vip-routed-10");
    expect(slides[1].frr?.name).toBe("edge-sonic-a");
    expect(slides[1].haproxy?.name).toBe("edge-1");
    expect(slides[1].lbRow?.servers_up).toBe(1);
  });

  it("filters to advertised VIP slides when requested", () => {
    const quiet: Vip = {
      ...vip,
      id: "vip-2",
      name: "vip-quiet",
      address: "203.0.113.20",
      advertised: false,
    };
    const slides = buildFlowSlides({
      vips: [vip, quiet],
      instances: [haproxy, frr],
      lbMetrics: undefined,
      advertisedOnly: true,
    });
    expect(slides).toHaveLength(2);
    expect(slides[0].kind).toBe("fleet");
    expect(slides[1].title).toBe("vip-routed-10");
  });

  it("resolves attachment IP for network", () => {
    expect(haproxyAttachmentIp(haproxy, "net-1")).toBe("192.168.22.10");
    expect(haproxyAttachmentIp(haproxy, "other")).toBe("192.168.22.10");
  });
});
