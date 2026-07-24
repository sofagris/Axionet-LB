import { describe, expect, it } from "vitest";
import { buildRuntimeGraph, statusTone } from "./buildGraph";
import type { HaproxyBackend, HaproxyFrontend } from "../../../types/haproxy";

const frontends: HaproxyFrontend[] = [
  {
    name: "web",
    bind_address: "*",
    bind_port: 8080,
    mode: "http",
    default_backend: "app",
    certificate: null,
  },
];

const backends: HaproxyBackend[] = [
  {
    name: "app",
    balance: "roundrobin",
    mode: "http",
    httpchk: true,
    httpchk_method: "GET",
    httpchk_uri: "/",
    httpchk_expect_status: 200,
    stick_table: false,
    stick_table_type: "ip",
    stick_table_key_len: 32,
    stick_table_size: "100k",
    stick_table_expire: "30m",
    stick_on: "src",
    servers: [
      {
        name: "web1",
        address: "10.0.0.10",
        port: 80,
        check: true,
        weight: 100,
        inter_ms: 2000,
        rise: 2,
        fall: 3,
      },
    ],
  },
];

describe("buildRuntimeGraph", () => {
  it("maps frontend → backend → server with edges", () => {
    const { nodes, edges } = buildRuntimeGraph({
      frontends,
      backends,
      status: {
        instance_id: "i1",
        available: true,
        frontends: [
          {
            proxy: "web",
            server: "FRONTEND",
            status: "OPEN",
            current_sessions: "2",
            bytes_in: "10",
            bytes_out: "20",
          },
        ],
        backends: [
          {
            proxy: "app",
            server: "BACKEND",
            status: "UP",
            current_sessions: "1",
            bytes_in: "5",
            bytes_out: "5",
          },
        ],
        servers: [
          {
            proxy: "app",
            server: "web1",
            status: "DOWN",
            current_sessions: "0",
            check_status: "L4TIMEOUT",
            weight: "100",
          },
        ],
      },
    });

    expect(nodes.map((n) => n.id)).toEqual(["fe:web", "be:app", "srv:app:web1"]);
    expect(edges.map((e) => e.id)).toEqual(["e:fe:web->be:app", "e:be:app->srv:app:web1"]);
    expect(nodes.find((n) => n.id === "srv:app:web1")?.data.status).toBe("DOWN");
    expect(nodes.find((n) => n.id === "srv:app:web1")?.data.checkStatus).toBe("L4TIMEOUT");
  });

  it("classifies status tones", () => {
    expect(statusTone("UP")).toBe("ok");
    expect(statusTone("OPEN")).toBe("ok");
    expect(statusTone("DRAIN")).toBe("warn");
    expect(statusTone("DOWN")).toBe("danger");
    expect(statusTone("MAINT")).toBe("muted");
  });
});
