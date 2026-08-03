import { describe, expect, it } from "vitest";
import {
  applyHydratedGroup,
  hydrateHaproxyGraph,
  toHaproxyDesiredState,
} from "./haproxyGraphMapper";
import type { DesignerNode } from "./types";

const fixture = {
  serviceId: "inst-1",
  groupId: "g1",
  groupPosition: { x: 10, y: 20 },
  label: "edge-1",
  frontends: [
    {
      name: "web",
      bind_address: "*",
      bind_port: 443,
      mode: "http",
      default_backend: "app",
      certificate: "site",
    },
    {
      name: "api",
      bind_address: "*",
      bind_port: 8443,
      mode: "http",
      default_backend: "app",
      certificate: null,
    },
  ],
  backends: [
    {
      name: "app",
      balance: "roundrobin",
      mode: "http",
      httpchk: false,
      httpchk_method: "GET" as const,
      httpchk_uri: "/",
      httpchk_expect_status: null,
      stick_table: false,
      stick_table_type: "ip" as const,
      stick_table_key_len: 32,
      stick_table_size: "100k",
      stick_table_expire: "30m",
      stick_on: "src",
      servers: [
        {
          name: "s1",
          address: "10.0.0.10",
          port: 80,
          check: true,
          weight: 100,
          inter_ms: 2000,
          rise: 2,
          fall: 3,
        },
        {
          name: "s2",
          address: "10.0.0.11",
          port: 80,
          check: true,
          weight: 50,
          inter_ms: 2000,
          rise: 2,
          fall: 3,
        },
      ],
    },
  ],
  errorFiles: [
    {
      name: "not-found",
      status_code: 404,
      filename: "errors/not-found.http",
      frontend: null,
      size_bytes: 100,
    },
    {
      name: "forbidden",
      status_code: 403,
      filename: "errors/forbidden.http",
      frontend: "api",
      size_bytes: 80,
    },
  ],
  acls: [
    {
      name: "is_api",
      frontend: "web",
      expression: "path_beg /api",
      use_backend: "app",
    },
  ],
};

describe("hydrateHaproxyGraph", () => {
  it("creates nodes for all frontends, backends, servers and error pages", () => {
    const { group, children, edges } = hydrateHaproxyGraph(fixture);
    expect(group.id).toBe("g1");
    expect(group.data.serviceId).toBe("inst-1");
    expect(group.data.hydrating).toBe(false);

    const roles = children.map((n) => n.data.componentRole);
    expect(roles.filter((r) => r === "frontend")).toHaveLength(2);
    expect(roles.filter((r) => r === "backend")).toHaveLength(1);
    expect(roles.filter((r) => r === "server")).toHaveLength(2);
    expect(roles.filter((r) => r === "error-page")).toHaveLength(2);

    const s2 = children.find((n) => n.data.props?.name === "s2");
    expect(s2?.data.props?.address).toBe("10.0.0.11");
    expect(s2?.data.props?.backend).toBe("app");
    expect(s2?.data.props?.weight).toBe("50");

    const web = children.find((n) => n.data.props?.name === "web");
    expect(web?.data.props?.bind).toBe("*:443");
    expect(web?.data.props?.certificate).toBe("site");

    // default_backend + ACL + 2 servers + defaults errorfile×2 FE + scoped errorfile
    expect(edges.some((e) => e.label === "default_backend")).toBe(true);
    expect(edges.some((e) => e.label === "is_api")).toBe(true);
    expect(edges.filter((e) => e.label === "server")).toHaveLength(2);
    expect(edges.filter((e) => e.label === "errorfile").length).toBeGreaterThanOrEqual(3);
  });

  it("round-trips to desired state with matching counts", () => {
    const { group, children, edges } = hydrateHaproxyGraph(fixture);
    const desired = toHaproxyDesiredState([group, ...children], edges, "inst-1");
    expect(desired.frontends).toHaveLength(2);
    expect(desired.backends).toHaveLength(1);
    expect(desired.backends[0]?.servers).toHaveLength(2);
    expect(desired.error_files).toHaveLength(2);
    expect(desired.frontends.map((f) => f.name).sort()).toEqual(["api", "web"]);
    expect(desired.backends[0]?.servers.map((s) => s.name).sort()).toEqual(["s1", "s2"]);
  });

  it("applyHydratedGroup preserves child positions by stable key", () => {
    const skeleton: DesignerNode[] = [
      {
        id: "g1",
        type: "designerGroup",
        position: { x: 0, y: 0 },
        style: { width: 400, height: 160 },
        data: { kind: "group.frame", label: "edge-1", serviceId: "inst-1" },
      },
      {
        id: "old-fe",
        type: "designer",
        parentId: "g1",
        position: { x: 120, y: 90 },
        data: {
          kind: "catalog.component",
          label: "web",
          componentRole: "frontend",
          serviceId: "inst-1",
          props: { name: "web" },
        },
      },
    ];
    const hydrated = hydrateHaproxyGraph(fixture);
    const { nodes, edges } = applyHydratedGroup(skeleton, [], "g1", hydrated);
    expect(nodes.find((n) => n.id === "old-fe")).toBeUndefined();
    const web = nodes.find(
      (n) => n.parentId === "g1" && n.data.props?.name === "web",
    );
    expect(web?.position).toEqual({ x: 120, y: 90 });
    expect(nodes.filter((n) => n.parentId === "g1").length).toBe(hydrated.children.length);
    expect(edges.length).toBe(hydrated.edges.length);
  });
});
