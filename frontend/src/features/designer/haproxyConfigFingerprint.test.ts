import { describe, expect, it } from "vitest";
import { fingerprintHaproxyConfig } from "./haproxyConfigFingerprint";
import type { HaproxyBackend, HaproxyServer } from "../../types/haproxy";

const server = (
  partial: Pick<HaproxyServer, "name" | "address" | "port"> &
    Partial<HaproxyServer>,
): HaproxyServer => ({
  check: true,
  weight: 1,
  inter_ms: 2000,
  rise: 2,
  fall: 3,
  ...partial,
});

const baseBackend = (name: string, servers: HaproxyBackend["servers"]): HaproxyBackend => ({
  name,
  balance: "roundrobin",
  mode: "http",
  httpchk: false,
  httpchk_method: "GET",
  httpchk_uri: "/",
  httpchk_expect_status: null,
  stick_table: false,
  stick_table_type: "ip",
  stick_table_key_len: 32,
  stick_table_size: "100k",
  stick_table_expire: "30m",
  stick_on: "src",
  servers,
});

describe("fingerprintHaproxyConfig", () => {
  it("is stable regardless of entity order", () => {
    const a = fingerprintHaproxyConfig({
      frontends: [
        {
          name: "b",
          bind_address: "*",
          bind_port: 80,
          mode: "http",
          default_backend: "app",
          certificate: null,
        },
        {
          name: "a",
          bind_address: "*",
          bind_port: 443,
          mode: "http",
          default_backend: "app",
          certificate: "cert",
        },
      ],
      backends: [
        baseBackend("z", [
          server({ name: "s2", address: "10.0.0.2", port: 80 }),
          server({ name: "s1", address: "10.0.0.1", port: 80 }),
        ]),
      ],
      errorFiles: [
        {
          name: "e404",
          status_code: 404,
          frontend: null,
          filename: "404.http",
          size_bytes: 12,
        },
      ],
      acls: [{ name: "is_api", frontend: "web", expression: "path_beg /api" }],
    });
    const b = fingerprintHaproxyConfig({
      frontends: [
        {
          name: "a",
          bind_address: "*",
          bind_port: 443,
          mode: "http",
          default_backend: "app",
          certificate: "cert",
        },
        {
          name: "b",
          bind_address: "*",
          bind_port: 80,
          mode: "http",
          default_backend: "app",
          certificate: null,
        },
      ],
      backends: [
        baseBackend("z", [
          server({ name: "s1", address: "10.0.0.1", port: 80 }),
          server({ name: "s2", address: "10.0.0.2", port: 80 }),
        ]),
      ],
      errorFiles: [
        {
          name: "e404",
          status_code: 404,
          frontend: null,
          filename: "404.http",
          size_bytes: 12,
        },
      ],
      acls: [{ name: "is_api", frontend: "web", expression: "path_beg /api" }],
    });
    expect(a).toBe(b);
  });

  it("changes when a server address changes", () => {
    const before = fingerprintHaproxyConfig({
      frontends: [],
      backends: [baseBackend("app", [server({ name: "s1", address: "10.0.0.1", port: 80 })])],
      errorFiles: [],
      acls: [],
    });
    const after = fingerprintHaproxyConfig({
      frontends: [],
      backends: [baseBackend("app", [server({ name: "s1", address: "10.0.0.99", port: 80 })])],
      errorFiles: [],
      acls: [],
    });
    expect(after).not.toBe(before);
  });
});
