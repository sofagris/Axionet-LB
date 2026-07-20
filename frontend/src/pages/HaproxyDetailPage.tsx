import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useHaproxyBackends,
  useHaproxyConfig,
  useHaproxyFrontends,
  useHaproxyMutations,
  useHaproxyStatus,
} from "../features/haproxy/hooks";
import { useInstances } from "../features/instances/hooks";

type Tab = "overview" | "frontends" | "backends" | "servers" | "status" | "config";

export function HaproxyDetailPage() {
  const { instanceId = "" } = useParams();
  const instancesQuery = useInstances();
  const instance = useMemo(
    () => instancesQuery.data?.find((item) => item.id === instanceId),
    [instancesQuery.data, instanceId],
  );

  const [tab, setTab] = useState<Tab>("overview");
  const frontendsQuery = useHaproxyFrontends(instanceId);
  const backendsQuery = useHaproxyBackends(instanceId);
  const configQuery = useHaproxyConfig(instanceId);
  const statusQuery = useHaproxyStatus(instanceId);
  const mutations = useHaproxyMutations(instanceId);

  const [frontendName, setFrontendName] = useState("web");
  const [frontendPort, setFrontendPort] = useState("8080");
  const [backendName, setBackendName] = useState("api");
  const [serverBackend, setServerBackend] = useState("app");
  const [serverName, setServerName] = useState("s2");
  const [serverAddress, setServerAddress] = useState("10.0.0.20");
  const [serverPort, setServerPort] = useState("80");

  if (!instanceId) {
    return <p className="text-danger">Mangler instance id</p>;
  }

  async function addFrontend(event: FormEvent) {
    event.preventDefault();
    await mutations.createFrontend.mutateAsync({
      name: frontendName,
      bind_address: "*",
      bind_port: Number(frontendPort),
      mode: "http",
      default_backend: "app",
    });
  }

  async function addBackend(event: FormEvent) {
    event.preventDefault();
    await mutations.createBackend.mutateAsync({
      name: backendName,
      balance: "roundrobin",
      mode: "http",
      servers: [],
    });
  }

  async function addServer(event: FormEvent) {
    event.preventDefault();
    await mutations.createServer.mutateAsync({
      backend: serverBackend,
      server: {
        name: serverName,
        address: serverAddress,
        port: Number(serverPort),
        check: true,
        weight: 100,
        inter_ms: 2000,
        rise: 2,
        fall: 3,
      },
    });
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "frontends", label: "Frontends" },
    { id: "backends", label: "Backends" },
    { id: "servers", label: "Servers" },
    { id: "status", label: "Runtime Status" },
    { id: "config", label: "Config" },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-muted">
            <Link to="/instances" className="hover:underline">
              Instances
            </Link>{" "}
            / HAProxy
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {instance?.name ?? instanceId}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {instance?.actual_state ?? "…"} · {instance?.health_status ?? "…"} ·{" "}
            {instance?.container_name ?? "no container"}
          </p>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 border-b border-line pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 text-sm ${
              tab === item.id
                ? "border-b-2 border-accent font-medium text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Frontends" value={String(frontendsQuery.data?.length ?? "…")} />
          <StatCard label="Backends" value={String(backendsQuery.data?.length ?? "…")} />
          <StatCard
            label="Servers"
            value={String(
              backendsQuery.data?.reduce((sum, backend) => sum + backend.servers.length, 0) ?? "…",
            )}
          />
        </section>
      ) : null}

      {tab === "frontends" ? (
        <section className="space-y-4">
          <form onSubmit={addFrontend} className="grid gap-3 rounded-lg border border-line bg-paper-elevated p-4 md:grid-cols-3">
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendName}
              onChange={(e) => setFrontendName(e.target.value)}
              placeholder="name"
              required
            />
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendPort}
              onChange={(e) => setFrontendPort(e.target.value)}
              placeholder="port"
              required
            />
            <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
              Legg til frontend
            </button>
          </form>
          <EntityTable
            headers={["Name", "Bind", "Mode", "Backend", ""]}
            rows={(frontendsQuery.data ?? []).map((item) => [
              item.name,
              `${item.bind_address}:${item.bind_port}`,
              item.mode,
              item.default_backend,
              <button
                key={`del-${item.name}`}
                type="button"
                className="text-danger hover:underline"
                onClick={() => mutations.deleteFrontend.mutate(item.name)}
              >
                Slett
              </button>,
            ])}
          />
        </section>
      ) : null}

      {tab === "backends" ? (
        <section className="space-y-4">
          <form onSubmit={addBackend} className="grid gap-3 rounded-lg border border-line bg-paper-elevated p-4 md:grid-cols-2">
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={backendName}
              onChange={(e) => setBackendName(e.target.value)}
              placeholder="backend name"
              required
            />
            <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
              Legg til backend
            </button>
          </form>
          <EntityTable
            headers={["Name", "Balance", "Mode", "Servers", ""]}
            rows={(backendsQuery.data ?? []).map((item) => [
              item.name,
              item.balance,
              item.mode,
              String(item.servers.length),
              <button
                key={`del-b-${item.name}`}
                type="button"
                className="text-danger hover:underline"
                onClick={() => mutations.deleteBackend.mutate(item.name)}
              >
                Slett
              </button>,
            ])}
          />
        </section>
      ) : null}

      {tab === "servers" ? (
        <section className="space-y-4">
          <form onSubmit={addServer} className="grid gap-3 rounded-lg border border-line bg-paper-elevated p-4 md:grid-cols-5">
            <select
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={serverBackend}
              onChange={(e) => setServerBackend(e.target.value)}
            >
              {(backendsQuery.data ?? []).map((backend) => (
                <option key={backend.name} value={backend.name}>
                  {backend.name}
                </option>
              ))}
            </select>
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="server"
              required
            />
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={serverAddress}
              onChange={(e) => setServerAddress(e.target.value)}
              placeholder="ip"
              required
            />
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              placeholder="port"
              required
            />
            <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
              Legg til server
            </button>
          </form>
          <EntityTable
            headers={["Backend", "Server", "Address", "Check", "Weight", ""]}
            rows={(backendsQuery.data ?? []).flatMap((backend) =>
              backend.servers.map((server) => [
                backend.name,
                server.name,
                `${server.address}:${server.port}`,
                server.check ? `yes/${server.inter_ms}ms` : "no",
                String(server.weight),
                <button
                  key={`del-s-${backend.name}-${server.name}`}
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() =>
                    mutations.deleteServer.mutate({ backend: backend.name, server: server.name })
                  }
                >
                  Slett
                </button>,
              ]),
            )}
          />
        </section>
      ) : null}

      {tab === "status" ? (
        <section className="space-y-4">
          {statusQuery.isError ? (
            <p className="text-danger">
              {statusQuery.error instanceof Error ? statusQuery.error.message : "Status utilgjengelig"}
            </p>
          ) : null}
          <EntityTable
            headers={["Proxy", "Server", "Status", "Sessions", "Check"]}
            rows={[
              ...(statusQuery.data?.frontends ?? []).map((row) => [
                row.proxy,
                row.server,
                row.status,
                row.current_sessions ?? "—",
                "—",
              ]),
              ...(statusQuery.data?.backends ?? []).map((row) => [
                row.proxy,
                row.server,
                row.status,
                row.current_sessions ?? "—",
                "—",
              ]),
              ...(statusQuery.data?.servers ?? []).map((row) => [
                row.proxy,
                row.server,
                row.status,
                row.current_sessions ?? "—",
                row.check_status ?? "—",
              ]),
            ]}
          />
        </section>
      ) : null}

      {tab === "config" ? (
        <pre className="overflow-auto rounded-lg border border-line bg-ink p-4 font-mono text-xs text-paper">
          {configQuery.data?.rendered ?? "Henter config…"}
        </pre>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-accent pl-3">
      <p className="text-xs tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  );
}

function EntityTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper-elevated p-4 shadow-sm">
      {rows.length === 0 ? (
        <p className="text-ink-muted">Ingen rader</p>
      ) : (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs tracking-wide text-ink-muted uppercase">
              {headers.map((header) => (
                <th key={header || "actions"} className="pb-2 pr-4 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-line align-top">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="py-3 pr-4 font-mono text-xs">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
