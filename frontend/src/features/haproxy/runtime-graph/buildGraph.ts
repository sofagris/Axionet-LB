import type { Edge, Node } from "@xyflow/react";
import type {
  HaproxyBackend,
  HaproxyFrontend,
  HaproxyRuntimeStatus,
} from "../../../types/haproxy";

export type GraphNodeKind = "frontend" | "backend" | "server";

export type RuntimeGraphNodeData = {
  kind: GraphNodeKind;
  name: string;
  status: string;
  subtitle: string;
  sessions: string;
  bytesIn: string;
  bytesOut: string;
  checkStatus: string;
  weight: string;
  mode: string;
  balance: string;
  bind: string;
  backendName: string;
  intervalMs: string;
  riseFall: string;
};

export type RuntimeGraphNode = Node<RuntimeGraphNodeData, "runtime">;

type StatRow = HaproxyRuntimeStatus["frontends"][number];

function findStat(
  rows: StatRow[] | undefined,
  proxy: string,
  server?: string,
): StatRow | undefined {
  return rows?.find((row) => {
    if (row.proxy !== proxy) return false;
    if (server == null) return true;
    return row.server === server;
  });
}

function normalizeStatus(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  return value || "UNKNOWN";
}

export function statusTone(status: string): "ok" | "warn" | "danger" | "muted" {
  const upper = status.toUpperCase();
  if (upper.includes("UP") || upper === "OPEN") return "ok";
  if (upper.includes("DRAIN")) return "warn";
  if (upper.includes("MAINT") || upper.includes("NOLB")) return "muted";
  if (
    upper.includes("DOWN") ||
    upper.includes("STOP") ||
    upper.includes("TIMEOUT") ||
    upper.includes("DENIED")
  ) {
    return "danger";
  }
  return "muted";
}

export function buildRuntimeGraph(input: {
  frontends: HaproxyFrontend[];
  backends: HaproxyBackend[];
  status: HaproxyRuntimeStatus | undefined;
}): { nodes: RuntimeGraphNode[]; edges: Edge[] } {
  const { frontends, backends, status } = input;
  const nodes: RuntimeGraphNode[] = [];
  const edges: Edge[] = [];

  const colX = { frontend: 0, backend: 340, server: 700 };
  const rowGap = 140;

  frontends.forEach((frontend, index) => {
    const stat = findStat(status?.frontends, frontend.name);
    const id = `fe:${frontend.name}`;
    nodes.push({
      id,
      type: "runtime",
      position: { x: colX.frontend, y: index * rowGap },
      data: {
        kind: "frontend",
        name: frontend.name,
        status: normalizeStatus(stat?.status),
        subtitle: `bind ${frontend.bind_address}:${frontend.bind_port}`,
        sessions: stat?.current_sessions ?? "—",
        bytesIn: stat?.bytes_in ?? "—",
        bytesOut: stat?.bytes_out ?? "—",
        checkStatus: "—",
        weight: "—",
        mode: frontend.mode,
        balance: "—",
        bind: `${frontend.bind_address}:${frontend.bind_port}`,
        backendName: frontend.default_backend,
        intervalMs: "—",
        riseFall: "—",
      },
    });
    if (frontend.default_backend) {
      edges.push({
        id: `e:${id}->be:${frontend.default_backend}`,
        source: id,
        target: `be:${frontend.default_backend}`,
        label: frontend.mode.toUpperCase(),
        animated: statusTone(normalizeStatus(stat?.status)) === "ok",
      });
    }
  });

  backends.forEach((backend, index) => {
    const stat = findStat(status?.backends, backend.name);
    const id = `be:${backend.name}`;
    nodes.push({
      id,
      type: "runtime",
      position: { x: colX.backend, y: index * rowGap },
      data: {
        kind: "backend",
        name: backend.name,
        status: normalizeStatus(stat?.status),
        subtitle: `algorithm ${backend.balance}`,
        sessions: stat?.current_sessions ?? "—",
        bytesIn: stat?.bytes_in ?? "—",
        bytesOut: stat?.bytes_out ?? "—",
        checkStatus: "—",
        weight: "—",
        mode: backend.mode,
        balance: backend.balance,
        bind: "—",
        backendName: backend.name,
        intervalMs: "—",
        riseFall: "—",
      },
    });

    backend.servers.forEach((server, serverIndex) => {
      const serverStat = findStat(status?.servers, backend.name, server.name);
      const serverId = `srv:${backend.name}:${server.name}`;
      const y =
        index * rowGap +
        (backend.servers.length > 1 ? (serverIndex - (backend.servers.length - 1) / 2) * 110 : 0);
      nodes.push({
        id: serverId,
        type: "runtime",
        position: { x: colX.server, y },
        data: {
          kind: "server",
          name: server.name,
          status: normalizeStatus(serverStat?.status),
          subtitle: `${server.address}:${server.port}`,
          sessions: serverStat?.current_sessions ?? "—",
          bytesIn: serverStat?.bytes_in ?? "—",
          bytesOut: serverStat?.bytes_out ?? "—",
          checkStatus: serverStat?.check_status ?? "—",
          weight: serverStat?.weight ?? String(server.weight),
          mode: backend.mode,
          balance: backend.balance,
          bind: `${server.address}:${server.port}`,
          backendName: backend.name,
          intervalMs: String(server.inter_ms),
          riseFall: `${server.rise} / ${server.fall}`,
        },
      });
      edges.push({
        id: `e:${id}->${serverId}`,
        source: id,
        target: serverId,
        label: backend.balance,
        animated: statusTone(normalizeStatus(serverStat?.status)) === "ok",
      });
    });
  });

  // Orphan runtime rows (present in stats but not config)
  for (const row of status?.frontends ?? []) {
    const id = `fe:${row.proxy}`;
    if (!nodes.some((node) => node.id === id)) {
      nodes.push({
        id,
        type: "runtime",
        position: { x: colX.frontend, y: nodes.filter((n) => n.data.kind === "frontend").length * rowGap },
        data: {
          kind: "frontend",
          name: row.proxy,
          status: normalizeStatus(row.status),
          subtitle: "from runtime",
          sessions: row.current_sessions ?? "—",
          bytesIn: row.bytes_in ?? "—",
          bytesOut: row.bytes_out ?? "—",
          checkStatus: "—",
          weight: "—",
          mode: "—",
          balance: "—",
          bind: "—",
          backendName: "—",
          intervalMs: "—",
          riseFall: "—",
        },
      });
    }
  }

  return { nodes, edges };
}
