import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useHaproxyBackends,
  useHaproxyConfig,
  useHaproxyFrontends,
  useHaproxyMutations,
  useHaproxyStatus,
} from "../features/haproxy/hooks";
import { useInstanceLogs, useInstances } from "../features/instances/hooks";
import { useRestoreRevision, useRevision, useRevisions } from "../features/revisions/hooks";
import type { HaproxyBackend, HaproxyFrontend, HaproxyServer } from "../types/haproxy";

type Tab =
  | "overview"
  | "frontends"
  | "backends"
  | "servers"
  | "certificates"
  | "acls"
  | "status"
  | "logs"
  | "revisions";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "frontends", label: "Frontends" },
  { id: "backends", label: "Backends" },
  { id: "servers", label: "Servers" },
  { id: "certificates", label: "Certificates" },
  { id: "acls", label: "ACLs" },
  { id: "status", label: "Runtime Status" },
  { id: "logs", label: "Logs" },
  { id: "revisions", label: "Revisions" },
];

export function HaproxyDetailPage() {
  const { instanceId = "" } = useParams();
  const instancesQuery = useInstances();
  const instance = useMemo(
    () => instancesQuery.data?.find((item) => item.id === instanceId),
    [instancesQuery.data, instanceId],
  );

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [logTail, setLogTail] = useState(200);

  const frontendsQuery = useHaproxyFrontends(instanceId);
  const backendsQuery = useHaproxyBackends(instanceId);
  const configQuery = useHaproxyConfig(instanceId);
  const statusQuery = useHaproxyStatus(instanceId);
  const revisionsQuery = useRevisions(instanceId);
  const revisionDetailQuery = useRevision(instanceId, selectedRevisionId);
  const restoreRevision = useRestoreRevision(instanceId);
  const logsQuery = useInstanceLogs(tab === "logs" ? instanceId : null, logTail);
  const mutations = useHaproxyMutations(instanceId);

  const [editingFrontend, setEditingFrontend] = useState<string | null>(null);
  const [frontendName, setFrontendName] = useState("web");
  const [frontendPort, setFrontendPort] = useState("8080");
  const [frontendBind, setFrontendBind] = useState("*");
  const [frontendMode, setFrontendMode] = useState("http");
  const [frontendBackend, setFrontendBackend] = useState("app");

  const [editingBackend, setEditingBackend] = useState<string | null>(null);
  const [backendName, setBackendName] = useState("api");
  const [backendBalance, setBackendBalance] = useState("roundrobin");
  const [backendMode, setBackendMode] = useState("http");

  const [editingServer, setEditingServer] = useState<{ backend: string; name: string } | null>(null);
  const [serverBackend, setServerBackend] = useState("app");
  const [serverName, setServerName] = useState("s2");
  const [serverAddress, setServerAddress] = useState("10.0.0.20");
  const [serverPort, setServerPort] = useState("80");
  const [serverWeight, setServerWeight] = useState("100");
  const [serverCheck, setServerCheck] = useState(true);

  useEffect(() => {
    const backends = backendsQuery.data;
    if (!backends?.length) return;
    if (!backends.some((item) => item.name === serverBackend)) {
      setServerBackend(backends[0].name);
    }
    if (!backends.some((item) => item.name === frontendBackend)) {
      setFrontendBackend(backends[0].name);
    }
  }, [backendsQuery.data, serverBackend, frontendBackend]);

  if (!instanceId) {
    return <p className="text-danger">Mangler instance id</p>;
  }

  function resetFrontendForm() {
    setEditingFrontend(null);
    setFrontendName("web");
    setFrontendPort("8080");
    setFrontendBind("*");
    setFrontendMode("http");
    setFrontendBackend(backendsQuery.data?.[0]?.name ?? "app");
  }

  function startEditFrontend(item: HaproxyFrontend) {
    setEditingFrontend(item.name);
    setFrontendName(item.name);
    setFrontendPort(String(item.bind_port));
    setFrontendBind(item.bind_address);
    setFrontendMode(item.mode);
    setFrontendBackend(item.default_backend);
  }

  async function saveFrontend(event: FormEvent) {
    event.preventDefault();
    const payload: HaproxyFrontend = {
      name: frontendName,
      bind_address: frontendBind,
      bind_port: Number(frontendPort),
      mode: frontendMode,
      default_backend: frontendBackend,
    };
    if (editingFrontend) {
      await mutations.updateFrontend.mutateAsync({ name: editingFrontend, payload });
    } else {
      await mutations.createFrontend.mutateAsync(payload);
    }
    resetFrontendForm();
  }

  function resetBackendForm() {
    setEditingBackend(null);
    setBackendName("api");
    setBackendBalance("roundrobin");
    setBackendMode("http");
  }

  function startEditBackend(item: HaproxyBackend) {
    setEditingBackend(item.name);
    setBackendName(item.name);
    setBackendBalance(item.balance);
    setBackendMode(item.mode);
  }

  async function saveBackend(event: FormEvent) {
    event.preventDefault();
    const existing = backendsQuery.data?.find((item) => item.name === (editingBackend ?? backendName));
    const payload: HaproxyBackend = {
      name: backendName,
      balance: backendBalance,
      mode: backendMode,
      servers: existing?.servers ?? [],
    };
    if (editingBackend) {
      await mutations.updateBackend.mutateAsync({ name: editingBackend, payload });
    } else {
      await mutations.createBackend.mutateAsync(payload);
    }
    resetBackendForm();
  }

  function resetServerForm() {
    setEditingServer(null);
    setServerName("s2");
    setServerAddress("10.0.0.20");
    setServerPort("80");
    setServerWeight("100");
    setServerCheck(true);
  }

  function startEditServer(backend: string, server: HaproxyServer) {
    setEditingServer({ backend, name: server.name });
    setServerBackend(backend);
    setServerName(server.name);
    setServerAddress(server.address);
    setServerPort(String(server.port));
    setServerWeight(String(server.weight));
    setServerCheck(server.check);
  }

  async function saveServer(event: FormEvent) {
    event.preventDefault();
    const payload: HaproxyServer = {
      name: serverName,
      address: serverAddress,
      port: Number(serverPort),
      check: serverCheck,
      weight: Number(serverWeight),
      inter_ms: 2000,
      rise: 2,
      fall: 3,
    };
    if (editingServer) {
      await mutations.updateServer.mutateAsync({
        backend: editingServer.backend,
        name: editingServer.name,
        server: payload,
      });
    } else {
      await mutations.createServer.mutateAsync({ backend: serverBackend, server: payload });
    }
    resetServerForm();
  }

  const serverCount =
    backendsQuery.data?.reduce((sum, backend) => sum + backend.servers.length, 0) ?? 0;
  const unhealthyServers =
    statusQuery.data?.servers.filter((row) => row.status && row.status.toUpperCase() !== "UP")
      .length ?? 0;

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
        {TABS.map((item) => (
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
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Frontends" value={String(frontendsQuery.data?.length ?? "…")} />
            <StatCard label="Backends" value={String(backendsQuery.data?.length ?? "…")} />
            <StatCard label="Servers" value={String(serverCount || "…")} />
            <StatCard
              label="Unhealthy"
              value={statusQuery.isError ? "—" : String(unhealthyServers)}
            />
            <StatCard
              label="IP / VIP"
              value={
                instance?.networks?.length
                  ? instance.networks.map((item) => item.ip_address || "dhcp").join(", ")
                  : "—"
              }
            />
            <StatCard label="Image" value={instance?.image ?? "—"} />
            <StatCard label="Desired" value={instance?.desired_state ?? "—"} />
            <StatCard label="Health" value={instance?.health_status ?? "—"} />
          </div>
          {instance?.last_error ? (
            <p className="font-mono text-xs text-danger">{instance.last_error}</p>
          ) : null}
          <div>
            <button
              type="button"
              className="text-sm text-accent hover:underline"
              onClick={() => setShowConfig((value) => !value)}
            >
              {showConfig ? "Skjul rendered config" : "Vis rendered config"}
            </button>
            {showConfig ? (
              <pre className="mt-3 max-h-[28rem] overflow-auto border border-line bg-ink p-4 font-mono text-xs text-paper">
                {configQuery.data?.rendered ?? "Henter config…"}
              </pre>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "frontends" ? (
        <section className="space-y-4">
          <form
            onSubmit={saveFrontend}
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-3 lg:grid-cols-6"
          >
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendName}
              onChange={(e) => setFrontendName(e.target.value)}
              placeholder="name"
              required
              disabled={editingFrontend != null}
            />
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendBind}
              onChange={(e) => setFrontendBind(e.target.value)}
              placeholder="bind"
              required
            />
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendPort}
              onChange={(e) => setFrontendPort(e.target.value)}
              placeholder="port"
              required
            />
            <select
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendMode}
              onChange={(e) => setFrontendMode(e.target.value)}
            >
              <option value="http">http</option>
              <option value="tcp">tcp</option>
            </select>
            <select
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={frontendBackend}
              onChange={(e) => setFrontendBackend(e.target.value)}
            >
              {(backendsQuery.data ?? []).map((backend) => (
                <option key={backend.name} value={backend.name}>
                  {backend.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingFrontend ? "Oppdater" : "Legg til"}
              </button>
              {editingFrontend ? (
                <button type="button" className="border border-line px-3 py-2 text-sm" onClick={resetFrontendForm}>
                  Avbryt
                </button>
              ) : null}
            </div>
          </form>
          <EntityTable
            headers={["Name", "Bind", "Mode", "Backend", ""]}
            rows={(frontendsQuery.data ?? []).map((item) => [
              item.name,
              `${item.bind_address}:${item.bind_port}`,
              item.mode,
              item.default_backend,
              <div key={`fe-${item.name}`} className="flex gap-3">
                <button type="button" className="text-accent hover:underline" onClick={() => startEditFrontend(item)}>
                  Rediger
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() => mutations.deleteFrontend.mutate(item.name)}
                >
                  Slett
                </button>
              </div>,
            ])}
          />
        </section>
      ) : null}

      {tab === "backends" ? (
        <section className="space-y-4">
          <form
            onSubmit={saveBackend}
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-4"
          >
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={backendName}
              onChange={(e) => setBackendName(e.target.value)}
              placeholder="backend name"
              required
              disabled={editingBackend != null}
            />
            <select
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={backendBalance}
              onChange={(e) => setBackendBalance(e.target.value)}
            >
              <option value="roundrobin">roundrobin</option>
              <option value="leastconn">leastconn</option>
              <option value="source">source</option>
            </select>
            <select
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={backendMode}
              onChange={(e) => setBackendMode(e.target.value)}
            >
              <option value="http">http</option>
              <option value="tcp">tcp</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingBackend ? "Oppdater" : "Legg til"}
              </button>
              {editingBackend ? (
                <button type="button" className="border border-line px-3 py-2 text-sm" onClick={resetBackendForm}>
                  Avbryt
                </button>
              ) : null}
            </div>
          </form>
          <EntityTable
            headers={["Name", "Balance", "Mode", "Servers", ""]}
            rows={(backendsQuery.data ?? []).map((item) => [
              item.name,
              item.balance,
              item.mode,
              String(item.servers.length),
              <div key={`be-${item.name}`} className="flex gap-3">
                <button type="button" className="text-accent hover:underline" onClick={() => startEditBackend(item)}>
                  Rediger
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() => mutations.deleteBackend.mutate(item.name)}
                >
                  Slett
                </button>
              </div>,
            ])}
          />
        </section>
      ) : null}

      {tab === "servers" ? (
        <section className="space-y-4">
          <form
            onSubmit={saveServer}
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-3 lg:grid-cols-7"
          >
            <select
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={serverBackend}
              onChange={(e) => setServerBackend(e.target.value)}
              disabled={editingServer != null}
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
              disabled={editingServer != null}
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
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              value={serverWeight}
              onChange={(e) => setServerWeight(e.target.value)}
              placeholder="weight"
              required
            />
            <label className="flex items-center gap-2 font-mono text-xs text-ink">
              <input
                type="checkbox"
                checked={serverCheck}
                onChange={(e) => setServerCheck(e.target.checked)}
              />
              check
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingServer ? "Oppdater" : "Legg til"}
              </button>
              {editingServer ? (
                <button type="button" className="border border-line px-3 py-2 text-sm" onClick={resetServerForm}>
                  Avbryt
                </button>
              ) : null}
            </div>
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
                <div key={`sv-${backend.name}-${server.name}`} className="flex gap-3">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => startEditServer(backend.name, server)}
                  >
                    Rediger
                  </button>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    onClick={() =>
                      mutations.deleteServer.mutate({ backend: backend.name, server: server.name })
                    }
                  >
                    Slett
                  </button>
                </div>,
              ]),
            )}
          />
        </section>
      ) : null}

      {tab === "certificates" ? (
        <PlaceholderPanel
          title="Certificates"
          body="TLS-sertifikatbinding kommer i en senere leveranse. Backend-API for /haproxy/certificates er ikke implementert ennå."
        />
      ) : null}

      {tab === "acls" ? (
        <PlaceholderPanel
          title="ACLs"
          body="ACL-redigering kommer i en senere leveranse. Backend-API for /haproxy/acls er ikke implementert ennå."
        />
      ) : null}

      {tab === "status" ? (
        <section className="space-y-4">
          {statusQuery.isError ? (
            <p className="text-danger">
              {statusQuery.error instanceof Error ? statusQuery.error.message : "Status utilgjengelig"}
            </p>
          ) : null}
          <EntityTable
            headers={["Proxy", "Server", "Status", "Sessions", "Bytes in/out", "Check"]}
            rows={[
              ...(statusQuery.data?.frontends ?? []).map((row) => [
                row.proxy,
                row.server,
                row.status,
                row.current_sessions ?? "—",
                `${row.bytes_in ?? "—"} / ${row.bytes_out ?? "—"}`,
                "—",
              ]),
              ...(statusQuery.data?.backends ?? []).map((row) => [
                row.proxy,
                row.server,
                row.status,
                row.current_sessions ?? "—",
                `${row.bytes_in ?? "—"} / ${row.bytes_out ?? "—"}`,
                "—",
              ]),
              ...(statusQuery.data?.servers ?? []).map((row) => [
                row.proxy,
                row.server,
                row.status,
                row.current_sessions ?? "—",
                `${row.bytes_in ?? "—"} / ${row.bytes_out ?? "—"}`,
                row.check_status ?? "—",
              ]),
            ]}
          />
        </section>
      ) : null}

      {tab === "logs" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="font-mono text-xs text-ink-muted">
              Tail{" "}
              <input
                type="number"
                min={50}
                max={5000}
                className="ml-2 w-24 border border-line bg-paper px-2 py-1"
                value={logTail}
                onChange={(e) => setLogTail(Number(e.target.value) || 200)}
              />
            </label>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm"
              onClick={() => void logsQuery.refetch()}
              disabled={logsQuery.isFetching}
            >
              {logsQuery.isFetching ? "Henter…" : "Oppdater"}
            </button>
          </div>
          {logsQuery.isError ? (
            <p className="text-danger">
              {logsQuery.error instanceof Error ? logsQuery.error.message : "Kunne ikke hente logger"}
            </p>
          ) : null}
          <pre className="max-h-[36rem] overflow-auto border border-line bg-ink p-4 font-mono text-xs text-paper whitespace-pre-wrap">
            {logsQuery.data?.logs || (logsQuery.isLoading ? "Henter logger…" : "Ingen loggoutput")}
          </pre>
        </section>
      ) : null}

      {tab === "revisions" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <EntityTable
              headers={["#", "Status", "Created", ""]}
              rows={(revisionsQuery.data ?? []).map((item) => [
                String(item.revision_number),
                `${item.deployment_status}/${item.validation_status}`,
                new Date(item.created_at).toLocaleString(),
                <div key={`rev-actions-${item.id}`} className="flex gap-3">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => setSelectedRevisionId(item.id)}
                  >
                    Vis
                  </button>
                  {item.deployment_status !== "deployed" ? (
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      disabled={restoreRevision.isPending}
                      onClick={() => restoreRevision.mutate(item.id)}
                    >
                      Restore
                    </button>
                  ) : (
                    "aktiv"
                  )}
                </div>,
              ])}
            />
            {restoreRevision.isError ? (
              <p className="text-danger">
                {restoreRevision.error instanceof Error
                  ? restoreRevision.error.message
                  : "Restore feilet"}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            {selectedRevisionId == null ? (
              <p className="text-ink-muted">Velg en revision for å se diff.</p>
            ) : revisionDetailQuery.isLoading ? (
              <p className="text-ink-muted">Henter revision…</p>
            ) : (
              <>
                <p className="font-mono text-xs text-ink-muted">
                  Revision {revisionDetailQuery.data?.revision_number} ·{" "}
                  {revisionDetailQuery.data?.deployment_status}
                </p>
                <pre className="max-h-[28rem] overflow-auto border border-line bg-ink p-4 font-mono text-xs text-paper">
                  {revisionDetailQuery.data?.diff_from_previous ||
                    revisionDetailQuery.data?.rendered_configuration ||
                    "Ingen diff"}
                </pre>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-l-2 border-line bg-paper-elevated/40 p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{body}</p>
    </section>
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
    <div className="overflow-x-auto border border-line bg-paper-elevated/40 p-4">
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
