import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useHaproxyAcls,
  useHaproxyBackends,
  useHaproxyCertificates,
  useHaproxyConfig,
  useHaproxyDefaults,
  useHaproxyFrontends,
  useHaproxyMaps,
  useHaproxyMutations,
  useHaproxyStatus,
} from "../features/haproxy/hooks";
import { DiffView } from "../features/revisions/DiffView";
import {
  useInstanceLogs,
  useInstanceMetrics,
  useInstanceAction,
  useInstanceNetworkMutations,
  useInstances,
  useValidateExistingInstance,
} from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";
import type { InstanceValidateResult } from "../types/instances";
import { useRestoreRevision, useRevision, useRevisions } from "../features/revisions/hooks";
import type { HaproxyAcl, HaproxyBackend, HaproxyFrontend, HaproxyServer } from "../types/haproxy";

type Tab =
  | "overview"
  | "frontends"
  | "backends"
  | "servers"
  | "certificates"
  | "maps"
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
  { id: "maps", label: "Maps" },
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
  const networksQuery = useNetworks();
  const networkMutations = useInstanceNetworkMutations();
  const [attachNetworkId, setAttachNetworkId] = useState("");
  const [attachIp, setAttachIp] = useState("");
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editAttachmentIp, setEditAttachmentIp] = useState("");

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [revisionView, setRevisionView] = useState<"diff" | "full">("diff");
  const [logTail, setLogTail] = useState(200);
  const [runtimeWeight, setRuntimeWeight] = useState("100");
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [configCopied, setConfigCopied] = useState(false);

  const frontendsQuery = useHaproxyFrontends(instanceId);
  const backendsQuery = useHaproxyBackends(instanceId);
  const certificatesQuery = useHaproxyCertificates(instanceId);
  const mapsQuery = useHaproxyMaps(instanceId);
  const aclsQuery = useHaproxyAcls(instanceId);
  const configQuery = useHaproxyConfig(instanceId);
  const defaultsQuery = useHaproxyDefaults(instanceId);
  const statusQuery = useHaproxyStatus(instanceId);
  const revisionsQuery = useRevisions(instanceId);
  const revisionDetailQuery = useRevision(instanceId, selectedRevisionId);
  const restoreRevision = useRestoreRevision(instanceId);
  const logsQuery = useInstanceLogs(tab === "logs" ? instanceId : null, logTail);
  const metricsQuery = useInstanceMetrics(tab === "overview" ? instanceId : null);
  const actionMutation = useInstanceAction();
  const validateMutation = useValidateExistingInstance();
  const [overviewValidation, setOverviewValidation] = useState<InstanceValidateResult | null>(null);
  const mutations = useHaproxyMutations(instanceId);

  const [editingFrontend, setEditingFrontend] = useState<string | null>(null);
  const [frontendName, setFrontendName] = useState("web");
  const [frontendPort, setFrontendPort] = useState("8080");
  const [frontendBind, setFrontendBind] = useState("*");
  const [frontendMode, setFrontendMode] = useState("http");
  const [frontendBackend, setFrontendBackend] = useState("app");
  const [frontendCertificate, setFrontendCertificate] = useState("");

  const [editingBackend, setEditingBackend] = useState<string | null>(null);
  const [backendName, setBackendName] = useState("api");
  const [backendBalance, setBackendBalance] = useState("roundrobin");
  const [backendMode, setBackendMode] = useState("http");
  const [backendHttpchk, setBackendHttpchk] = useState(false);
  const [backendHttpchkMethod, setBackendHttpchkMethod] = useState<"OPTIONS" | "HEAD" | "GET">("GET");
  const [backendHttpchkUri, setBackendHttpchkUri] = useState("/");
  const [backendHttpchkExpect, setBackendHttpchkExpect] = useState("");

  const [editingServer, setEditingServer] = useState<{ backend: string; name: string } | null>(null);
  const [serverBackend, setServerBackend] = useState("app");
  const [serverName, setServerName] = useState("s2");
  const [serverAddress, setServerAddress] = useState("10.0.0.20");
  const [serverPort, setServerPort] = useState("80");
  const [serverWeight, setServerWeight] = useState("100");
  const [serverCheck, setServerCheck] = useState(true);
  const [serverInterMs, setServerInterMs] = useState("2000");
  const [serverRise, setServerRise] = useState("2");
  const [serverFall, setServerFall] = useState("3");

  const [certName, setCertName] = useState("site");
  const [certPem, setCertPem] = useState("");

  const [editingMap, setEditingMap] = useState<string | null>(null);
  const [mapName, setMapName] = useState("hosts");
  const [mapContent, setMapContent] = useState("# key value\nexample.com be1\n");

  const [editingAcl, setEditingAcl] = useState<string | null>(null);
  const [aclName, setAclName] = useState("is_api");
  const [aclFrontend, setAclFrontend] = useState("web");
  const [aclExpression, setAclExpression] = useState("path_beg /api");
  const [aclBackend, setAclBackend] = useState("");

  const [defaultsMode, setDefaultsMode] = useState("http");
  const [defaultsStatsPort, setDefaultsStatsPort] = useState("8404");
  const [defaultsTimeoutConnect, setDefaultsTimeoutConnect] = useState("5s");
  const [defaultsTimeoutClient, setDefaultsTimeoutClient] = useState("30s");
  const [defaultsTimeoutServer, setDefaultsTimeoutServer] = useState("30s");

  useEffect(() => {
    const defaults = defaultsQuery.data;
    if (!defaults) return;
    setDefaultsMode(defaults.mode);
    setDefaultsStatsPort(String(defaults.stats_port));
    setDefaultsTimeoutConnect(defaults.timeout_connect);
    setDefaultsTimeoutClient(defaults.timeout_client);
    setDefaultsTimeoutServer(defaults.timeout_server);
  }, [defaultsQuery.data]);

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

  useEffect(() => {
    const frontends = frontendsQuery.data;
    if (!frontends?.length) return;
    if (!frontends.some((item) => item.name === aclFrontend)) {
      setAclFrontend(frontends[0].name);
    }
  }, [frontendsQuery.data, aclFrontend]);

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
    setFrontendCertificate("");
  }

  function startEditFrontend(item: HaproxyFrontend) {
    setEditingFrontend(item.name);
    setFrontendName(item.name);
    setFrontendPort(String(item.bind_port));
    setFrontendBind(item.bind_address);
    setFrontendMode(item.mode);
    setFrontendBackend(item.default_backend);
    setFrontendCertificate(item.certificate ?? "");
  }

  async function saveFrontend(event: FormEvent) {
    event.preventDefault();
    const payload: HaproxyFrontend = {
      name: frontendName,
      bind_address: frontendBind,
      bind_port: Number(frontendPort),
      mode: frontendMode,
      default_backend: frontendBackend,
      certificate: frontendCertificate || null,
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
    setBackendHttpchk(false);
    setBackendHttpchkMethod("GET");
    setBackendHttpchkUri("/");
    setBackendHttpchkExpect("");
  }

  function startEditBackend(item: HaproxyBackend) {
    setEditingBackend(item.name);
    setBackendName(item.name);
    setBackendBalance(item.balance);
    setBackendMode(item.mode);
    setBackendHttpchk(item.httpchk);
    setBackendHttpchkMethod(item.httpchk_method);
    setBackendHttpchkUri(item.httpchk_uri);
    setBackendHttpchkExpect(
      item.httpchk_expect_status != null ? String(item.httpchk_expect_status) : "",
    );
  }

  async function saveBackend(event: FormEvent) {
    event.preventDefault();
    const existing = backendsQuery.data?.find((item) => item.name === (editingBackend ?? backendName));
    const expectRaw = backendHttpchkExpect.trim();
    const payload: HaproxyBackend = {
      name: backendName,
      balance: backendBalance,
      mode: backendMode,
      httpchk: backendMode === "http" ? backendHttpchk : false,
      httpchk_method: backendHttpchkMethod,
      httpchk_uri: backendHttpchkUri.trim() || "/",
      httpchk_expect_status: expectRaw ? Number(expectRaw) : null,
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
    setServerInterMs("2000");
    setServerRise("2");
    setServerFall("3");
  }

  function startEditServer(backend: string, server: HaproxyServer) {
    setEditingServer({ backend, name: server.name });
    setServerBackend(backend);
    setServerName(server.name);
    setServerAddress(server.address);
    setServerPort(String(server.port));
    setServerWeight(String(server.weight));
    setServerCheck(server.check);
    setServerInterMs(String(server.inter_ms));
    setServerRise(String(server.rise));
    setServerFall(String(server.fall));
  }

  async function saveServer(event: FormEvent) {
    event.preventDefault();
    const payload: HaproxyServer = {
      name: serverName,
      address: serverAddress,
      port: Number(serverPort),
      check: serverCheck,
      weight: Number(serverWeight),
      inter_ms: Number(serverInterMs),
      rise: Number(serverRise),
      fall: Number(serverFall),
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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={actionMutation.isPending}
              className="border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60"
              onClick={() => actionMutation.mutate({ id: instanceId, action: "reload" })}
            >
              Soft reload
            </button>
            <button
              type="button"
              disabled={actionMutation.isPending}
              className="border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60"
              onClick={() => actionMutation.mutate({ id: instanceId, action: "reconcile" })}
            >
              Reconcile
            </button>
            <button
              type="button"
              disabled={validateMutation.isPending}
              className="border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60"
              onClick={() => {
                void validateMutation.mutateAsync(instanceId).then(setOverviewValidation);
              }}
            >
              Validate
            </button>
            <button
              type="button"
              disabled={actionMutation.isPending}
              className="border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60"
              onClick={() => actionMutation.mutate({ id: instanceId, action: "restart" })}
            >
              Restart
            </button>
          </div>
          {actionMutation.isError ? (
            <p className="text-sm text-danger">
              {actionMutation.error instanceof Error ? actionMutation.error.message : "Feil"}
            </p>
          ) : null}
          {overviewValidation ? (
            <p className={`font-mono text-sm ${overviewValidation.ok ? "text-ok" : "text-danger"}`}>
              {overviewValidation.ok ? "Config valid" : "Config invalid"}: {overviewValidation.output}
            </p>
          ) : null}
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
            <StatCard
              label="Sessions"
              value={
                metricsQuery.data?.available
                  ? String(metricsQuery.data.current_sessions)
                  : metricsQuery.data?.detail
                    ? "—"
                    : "…"
              }
            />
            <StatCard
              label="Session rate"
              value={metricsQuery.data?.available ? String(metricsQuery.data.session_rate) : "—"}
            />
            <StatCard
              label="Servers up"
              value={
                metricsQuery.data?.available
                  ? `${metricsQuery.data.servers_up}/${metricsQuery.data.servers_total}`
                  : "—"
              }
            />
            <StatCard
              label="Bytes out"
              value={
                metricsQuery.data?.available ? String(metricsQuery.data.bytes_out) : "—"
              }
            />
          </div>

          <div className="space-y-3 border border-line bg-paper-elevated/40 p-4">
            <div>
              <h3 className="font-semibold text-ink">Nettverkstilknytninger</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Legg til, endre IP eller fjern Docker-nettverk for denne instansen uten recreate.
              </p>
            </div>
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!attachNetworkId) return;
                void networkMutations.attach
                  .mutateAsync({
                    id: instanceId,
                    payload: {
                      network_id: attachNetworkId,
                      ip_address: attachIp.trim() || null,
                    },
                  })
                  .then(() => {
                    setAttachNetworkId("");
                    setAttachIp("");
                  });
              }}
            >
              <FormField label="Nettverk">
                <select
                  className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  value={attachNetworkId}
                  onChange={(e) => setAttachNetworkId(e.target.value)}
                  required
                >
                  <option value="">Velg nettverk…</option>
                  {(networksQuery.data ?? [])
                    .filter(
                      (net) =>
                        net.enabled &&
                        !(instance?.networks ?? []).some((item) => item.network_id === net.id),
                    )
                    .map((net) => (
                      <option key={net.id} value={net.id}>
                        {net.name}
                        {net.subnet ? ` (${net.subnet})` : ""}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label="IP (valgfritt)">
                <input
                  className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  value={attachIp}
                  onChange={(e) => setAttachIp(e.target.value)}
                  placeholder="DHCP hvis tom"
                />
              </FormField>
              <FormActions>
                <button
                  type="submit"
                  className="border border-accent bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
                  disabled={networkMutations.attach.isPending || !attachNetworkId}
                >
                  Koble til
                </button>
              </FormActions>
            </form>
            {networkMutations.attach.isError ||
            networkMutations.update.isError ||
            networkMutations.detach.isError ? (
              <p className="text-sm text-danger">
                {(
                  networkMutations.attach.error ||
                  networkMutations.update.error ||
                  networkMutations.detach.error
                ) instanceof Error
                  ? (
                      networkMutations.attach.error ||
                      networkMutations.update.error ||
                      networkMutations.detach.error
                    )?.message
                  : "Nettverksfeil"}
              </p>
            ) : null}
            <EntityTable
              headers={["Network", "IP", ""]}
              rows={(instance?.networks ?? []).map((item) => {
                const networkName =
                  networksQuery.data?.find((net) => net.id === item.network_id)?.name ??
                  item.network_id;
                const editing = editingAttachmentId === item.id;
                return [
                  networkName,
                  editing ? (
                    <input
                      key={`ip-${item.id}`}
                      className="w-full border border-line bg-paper px-2 py-1 font-mono text-sm"
                      value={editAttachmentIp}
                      onChange={(e) => setEditAttachmentIp(e.target.value)}
                      placeholder="DHCP hvis tom"
                    />
                  ) : (
                    item.ip_address || "dhcp"
                  ),
                  <div key={`net-actions-${item.id}`} className="flex flex-wrap gap-3">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          onClick={() => {
                            void networkMutations.update
                              .mutateAsync({
                                id: instanceId,
                                attachmentId: item.id,
                                payload: { ip_address: editAttachmentIp.trim() || null },
                              })
                              .then(() => setEditingAttachmentId(null));
                          }}
                        >
                          Lagre
                        </button>
                        <button
                          type="button"
                          className="text-ink-muted hover:underline"
                          onClick={() => setEditingAttachmentId(null)}
                        >
                          Avbryt
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => {
                          setEditingAttachmentId(item.id);
                          setEditAttachmentIp(item.ip_address ?? "");
                        }}
                      >
                        Endre IP
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={() => {
                        if (!window.confirm(`Koble fra ${networkName}?`)) return;
                        void networkMutations.detach.mutateAsync({
                          id: instanceId,
                          attachmentId: item.id,
                        });
                      }}
                    >
                      Koble fra
                    </button>
                  </div>,
                ];
              })}
            />
            {(instance?.networks ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">Ingen nettverkstilknytninger.</p>
            ) : null}
          </div>
          {metricsQuery.data && !metricsQuery.data.available && metricsQuery.data.detail ? (
            <p className="font-mono text-xs text-ink-muted">{metricsQuery.data.detail}</p>
          ) : null}
          {instance?.last_error ? (
            <p className="font-mono text-xs text-danger">{instance.last_error}</p>
          ) : null}

          <form
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-3 lg:grid-cols-5"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutations.updateDefaults.mutateAsync({
                mode: defaultsMode as "http" | "tcp",
                stats_port: Number(defaultsStatsPort) || 8404,
                timeout_connect: defaultsTimeoutConnect,
                timeout_client: defaultsTimeoutClient,
                timeout_server: defaultsTimeoutServer,
              });
            }}
          >
            <p className="md:col-span-3 lg:col-span-5 text-sm text-ink-muted">
              Global defaults (mode, stats-port, timeouts). Soft-reloades ved lagring.
            </p>
            <FormField label="Mode">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={defaultsMode}
                onChange={(e) => setDefaultsMode(e.target.value)}
              >
                <option value="http">http</option>
                <option value="tcp">tcp</option>
              </select>
            </FormField>
            <FormField label="Stats port">
              <input
                type="number"
                min={1}
                max={65535}
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={defaultsStatsPort}
                onChange={(e) => setDefaultsStatsPort(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Timeout connect">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={defaultsTimeoutConnect}
                onChange={(e) => setDefaultsTimeoutConnect(e.target.value)}
                placeholder="5s"
                required
              />
            </FormField>
            <FormField label="Timeout client">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={defaultsTimeoutClient}
                onChange={(e) => setDefaultsTimeoutClient(e.target.value)}
                placeholder="30s"
                required
              />
            </FormField>
            <FormField label="Timeout server">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={defaultsTimeoutServer}
                onChange={(e) => setDefaultsTimeoutServer(e.target.value)}
                placeholder="30s"
                required
              />
            </FormField>
            <FormActions>
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                Lagre defaults
              </button>
            </FormActions>
            {mutations.updateDefaults.isError ? (
              <p className="md:col-span-3 lg:col-span-5 text-sm text-danger">
                {mutations.updateDefaults.error instanceof Error
                  ? mutations.updateDefaults.error.message
                  : "Kunne ikke lagre defaults"}
              </p>
            ) : null}
          </form>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm text-accent hover:underline"
                onClick={() => setShowConfig((value) => !value)}
              >
                {showConfig ? "Skjul rendered config" : "Vis rendered config"}
              </button>
              <button
                type="button"
                className="text-sm text-accent hover:underline disabled:opacity-50"
                disabled={!configQuery.data?.rendered}
                onClick={() => {
                  const text = configQuery.data?.rendered;
                  if (!text) return;
                  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `${instance?.name || instanceId}-haproxy.cfg`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Last ned .cfg
              </button>
              <button
                type="button"
                className="text-sm text-accent hover:underline disabled:opacity-50"
                disabled={!configQuery.data?.rendered}
                onClick={async () => {
                  const text = configQuery.data?.rendered;
                  if (!text) return;
                  await navigator.clipboard.writeText(text);
                  setConfigCopied(true);
                  window.setTimeout(() => setConfigCopied(false), 1500);
                }}
              >
                {configCopied ? "Kopiert" : "Kopier config"}
              </button>
            </div>
            {showConfig ? (
              <pre className="max-h-[28rem] overflow-auto border border-line bg-ink p-4 font-mono text-xs text-paper">
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
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-3 lg:grid-cols-4"
          >
            <FormField label="Navn">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={frontendName}
                onChange={(e) => setFrontendName(e.target.value)}
                placeholder="web"
                required
                disabled={editingFrontend != null}
              />
            </FormField>
            <FormField label="Bind-adresse">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={frontendBind}
                onChange={(e) => setFrontendBind(e.target.value)}
                placeholder="*"
                required
              />
            </FormField>
            <FormField label="Port">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={frontendPort}
                onChange={(e) => setFrontendPort(e.target.value)}
                placeholder="8080"
                required
              />
            </FormField>
            <FormField label="Mode">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={frontendMode}
                onChange={(e) => setFrontendMode(e.target.value)}
              >
                <option value="http">http</option>
                <option value="tcp">tcp</option>
              </select>
            </FormField>
            <FormField label="Default backend">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={frontendBackend}
                onChange={(e) => setFrontendBackend(e.target.value)}
              >
                {(backendsQuery.data ?? []).map((backend) => (
                  <option key={backend.name} value={backend.name}>
                    {backend.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="TLS-sertifikat">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={frontendCertificate}
                onChange={(e) => setFrontendCertificate(e.target.value)}
              >
                <option value="">Ingen TLS</option>
                {(certificatesQuery.data ?? []).map((cert) => (
                  <option key={cert.name} value={cert.name}>
                    {cert.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormActions>
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingFrontend ? "Oppdater" : "Legg til"}
              </button>
              {editingFrontend ? (
                <button type="button" className="border border-line px-3 py-2 text-sm" onClick={resetFrontendForm}>
                  Avbryt
                </button>
              ) : null}
            </FormActions>
          </form>
          <EntityTable
            headers={["Name", "Bind", "Mode", "Backend", "TLS", ""]}
            rows={(frontendsQuery.data ?? []).map((item) => [
              item.name,
              `${item.bind_address}:${item.bind_port}`,
              item.mode,
              item.default_backend,
              item.certificate ?? "—",
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
            <FormField label="Navn">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={backendName}
                onChange={(e) => setBackendName(e.target.value)}
                placeholder="app"
                required
                disabled={editingBackend != null}
              />
            </FormField>
            <FormField label="Balance">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={backendBalance}
                onChange={(e) => setBackendBalance(e.target.value)}
              >
                <option value="roundrobin">roundrobin</option>
                <option value="leastconn">leastconn</option>
                <option value="source">source</option>
              </select>
            </FormField>
            <FormField label="Mode">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={backendMode}
                onChange={(e) => setBackendMode(e.target.value)}
              >
                <option value="http">http</option>
                <option value="tcp">tcp</option>
              </select>
            </FormField>
            <FormField label="HTTP check">
              <label className="flex items-center gap-2 py-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={backendHttpchk && backendMode === "http"}
                  disabled={backendMode !== "http"}
                  onChange={(e) => setBackendHttpchk(e.target.checked)}
                />
                option httpchk
              </label>
            </FormField>
            {backendMode === "http" && backendHttpchk ? (
              <>
                <FormField label="Method">
                  <select
                    className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    value={backendHttpchkMethod}
                    onChange={(e) =>
                      setBackendHttpchkMethod(e.target.value as "OPTIONS" | "HEAD" | "GET")
                    }
                  >
                    <option value="GET">GET</option>
                    <option value="HEAD">HEAD</option>
                    <option value="OPTIONS">OPTIONS</option>
                  </select>
                </FormField>
                <FormField label="URI">
                  <input
                    className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    value={backendHttpchkUri}
                    onChange={(e) => setBackendHttpchkUri(e.target.value)}
                    placeholder="/healthz"
                    required
                  />
                </FormField>
                <FormField label="Expect status">
                  <input
                    className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    value={backendHttpchkExpect}
                    onChange={(e) => setBackendHttpchkExpect(e.target.value)}
                    placeholder="200 (valgfritt)"
                    inputMode="numeric"
                  />
                </FormField>
              </>
            ) : null}
            <FormActions>
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingBackend ? "Oppdater" : "Legg til"}
              </button>
              {editingBackend ? (
                <button type="button" className="border border-line px-3 py-2 text-sm" onClick={resetBackendForm}>
                  Avbryt
                </button>
              ) : null}
            </FormActions>
          </form>
          <EntityTable
            headers={["Name", "Balance", "Mode", "HTTP check", "Servers", ""]}
            rows={(backendsQuery.data ?? []).map((item) => [
              item.name,
              item.balance,
              item.mode,
              item.mode === "http" && item.httpchk
                ? `${item.httpchk_method} ${item.httpchk_uri}${
                    item.httpchk_expect_status != null ? ` → ${item.httpchk_expect_status}` : ""
                  }`
                : "—",
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
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-3 lg:grid-cols-5"
          >
            <FormField label="Backend">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
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
            </FormField>
            <FormField label="Servernavn">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="s2"
                required
                disabled={editingServer != null}
              />
            </FormField>
            <FormField label="Adresse">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="10.0.0.20"
                required
              />
            </FormField>
            <FormField label="Port">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="80"
                required
              />
            </FormField>
            <FormField label="Vekt">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={serverWeight}
                onChange={(e) => setServerWeight(e.target.value)}
                placeholder="100"
                required
              />
            </FormField>
            <FormField label="Health check">
              <span className="flex h-[38px] items-center gap-2 font-mono text-xs text-ink">
                <input
                  type="checkbox"
                  checked={serverCheck}
                  onChange={(e) => setServerCheck(e.target.checked)}
                />
                Aktiv
              </span>
            </FormField>
            <FormField label="Intervall (ms)">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm disabled:opacity-50"
                type="number"
                min={100}
                max={60000}
                value={serverInterMs}
                onChange={(e) => setServerInterMs(e.target.value)}
                placeholder="2000"
                disabled={!serverCheck}
              />
            </FormField>
            <FormField label="Rise">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm disabled:opacity-50"
                type="number"
                min={1}
                max={100}
                value={serverRise}
                onChange={(e) => setServerRise(e.target.value)}
                placeholder="2"
                disabled={!serverCheck}
              />
            </FormField>
            <FormField label="Fall">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm disabled:opacity-50"
                type="number"
                min={1}
                max={100}
                value={serverFall}
                onChange={(e) => setServerFall(e.target.value)}
                placeholder="3"
                disabled={!serverCheck}
              />
            </FormField>
            <FormActions>
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingServer ? "Oppdater" : "Legg til"}
              </button>
              {editingServer ? (
                <button type="button" className="border border-line px-3 py-2 text-sm" onClick={resetServerForm}>
                  Avbryt
                </button>
              ) : null}
            </FormActions>
          </form>
          <EntityTable
            headers={["Backend", "Server", "Address", "Check", "Weight", ""]}
            rows={(backendsQuery.data ?? []).flatMap((backend) =>
              backend.servers.map((server) => [
                backend.name,
                server.name,
                `${server.address}:${server.port}`,
                server.check
                  ? `yes/${server.inter_ms}ms r${server.rise}/f${server.fall}`
                  : "no",
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
        <section className="space-y-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await mutations.createCertificate.mutateAsync({ name: certName, pem: certPem });
              setCertPem("");
            }}
            className="space-y-3 border border-line bg-paper-elevated/40 p-4"
          >
            <p className="text-sm text-ink-muted">
              Last opp kombinert PEM (sertifikat + privat nøkkel). Filen lagres under{" "}
              <span className="font-mono">config/certs/</span> med restriktive rettigheter.
            </p>
            <FormField label="Sertifikatnavn">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                placeholder="site"
                required
              />
            </FormField>
            <FormField label="PEM-innhold">
              <textarea
                className="min-h-40 w-full border border-line bg-paper px-3 py-2 font-mono text-xs"
                value={certPem}
                onChange={(e) => setCertPem(e.target.value)}
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----BEGIN PRIVATE KEY-----\n..."}
                required
              />
            </FormField>            <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
              Last opp sertifikat
            </button>
            {mutations.createCertificate.isError ? (
              <p className="text-sm text-danger">
                {mutations.createCertificate.error instanceof Error
                  ? mutations.createCertificate.error.message
                  : "Opplasting feilet"}
              </p>
            ) : null}
          </form>
          <EntityTable
            headers={["Name", "Filename", "Size", ""]}
            rows={(certificatesQuery.data ?? []).map((item) => [
              item.name,
              item.filename,
              `${item.size_bytes} B`,
              <button
                key={`cert-${item.name}`}
                type="button"
                className="text-danger hover:underline"
                onClick={() => mutations.deleteCertificate.mutate(item.name)}
              >
                Slett
              </button>,
            ])}
          />
        </section>
      ) : null}

      {tab === "maps" ? (
        <section className="space-y-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (editingMap) {
                await mutations.updateMap.mutateAsync({ name: editingMap, content: mapContent });
              } else {
                await mutations.createMap.mutateAsync({ name: mapName, content: mapContent });
              }
              setEditingMap(null);
              setMapName("hosts");
              setMapContent("# key value\nexample.com be1\n");
            }}
            className="space-y-3 border border-line bg-paper-elevated/40 p-4"
          >
            <p className="text-sm text-ink-muted">
              Map-filer lagres under <span className="font-mono">config/maps/</span> og er tilgjengelige i
              container som <span className="font-mono">/usr/local/etc/haproxy/maps/&lt;navn&gt;.map</span>.
              Referer dem i ACL-uttrykk, f.eks.{" "}
              <span className="font-mono">path,map_beg(/usr/local/etc/haproxy/maps/hosts.map)</span>.
            </p>
            <FormField label="Map-navn">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="hosts"
                required
                disabled={Boolean(editingMap)}
              />
            </FormField>
            <FormField label="Innhold (key value per linje)">
              <textarea
                className="min-h-40 w-full border border-line bg-paper px-3 py-2 font-mono text-xs"
                value={mapContent}
                onChange={(e) => setMapContent(e.target.value)}
                required
              />
            </FormField>
            <FormActions>
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingMap ? "Oppdater map" : "Opprett map"}
              </button>
              {editingMap ? (
                <button
                  type="button"
                  className="border border-line px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingMap(null);
                    setMapName("hosts");
                    setMapContent("# key value\nexample.com be1\n");
                  }}
                >
                  Avbryt
                </button>
              ) : null}
            </FormActions>
            {mutations.createMap.isError || mutations.updateMap.isError ? (
              <p className="text-sm text-danger">
                {(mutations.createMap.error || mutations.updateMap.error) instanceof Error
                  ? ((mutations.createMap.error || mutations.updateMap.error) as Error).message
                  : "Map-lagring feilet"}
              </p>
            ) : null}
          </form>
          <EntityTable
            headers={["Name", "Filename", "Size", ""]}
            rows={(mapsQuery.data ?? []).map((item) => [
              item.name,
              item.filename,
              `${item.size_bytes} B`,
              <div key={`map-${item.name}`} className="flex gap-3">
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={async () => {
                    const detail = await mutations.loadMap.mutateAsync(item.name);
                    setEditingMap(detail.name);
                    setMapName(detail.name);
                    setMapContent(detail.content);
                  }}
                >
                  Rediger
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() => mutations.deleteMap.mutate(item.name)}
                >
                  Slett
                </button>
              </div>,
            ])}
          />
        </section>
      ) : null}

      {tab === "acls" ? (
        <section className="space-y-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const payload: HaproxyAcl = {
                name: aclName,
                frontend: aclFrontend,
                expression: aclExpression,
                use_backend: aclBackend || null,
              };
              if (editingAcl) {
                await mutations.updateAcl.mutateAsync({ name: editingAcl, payload });
              } else {
                await mutations.createAcl.mutateAsync(payload);
              }
              setEditingAcl(null);
              setAclName("is_api");
              setAclExpression("path_beg /api");
              setAclBackend("");
            }}
            className="grid gap-3 border border-line bg-paper-elevated/40 p-4 md:grid-cols-2 lg:grid-cols-5"
          >
            <FormField label="Navn">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={aclName}
                onChange={(e) => setAclName(e.target.value)}
                placeholder="is_api"
                required
                disabled={editingAcl != null}
              />
            </FormField>
            <FormField label="Frontend">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={aclFrontend}
                onChange={(e) => setAclFrontend(e.target.value)}
              >
                {(frontendsQuery.data ?? []).map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Uttrykk">
              <input
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={aclExpression}
                onChange={(e) => setAclExpression(e.target.value)}
                placeholder="path_beg /api"
                required
              />
            </FormField>
            <FormField label="use_backend">
              <select
                className="w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={aclBackend}
                onChange={(e) => setAclBackend(e.target.value)}
              >
                <option value="">Ingen</option>
                {(backendsQuery.data ?? []).map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormActions>
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingAcl ? "Oppdater" : "Legg til"}
              </button>
              {editingAcl ? (
                <button
                  type="button"
                  className="border border-line px-3 py-2 text-sm"
                  onClick={() => setEditingAcl(null)}
                >
                  Avbryt
                </button>
              ) : null}
            </FormActions>
          </form>
          <EntityTable
            headers={["Name", "Frontend", "Expression", "use_backend", ""]}
            rows={(aclsQuery.data ?? []).map((item) => [
              item.name,
              item.frontend,
              item.expression,
              item.use_backend ?? "—",
              <div key={`acl-${item.name}`} className="flex gap-3">
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    setEditingAcl(item.name);
                    setAclName(item.name);
                    setAclFrontend(item.frontend);
                    setAclExpression(item.expression);
                    setAclBackend(item.use_backend ?? "");
                  }}
                >
                  Rediger
                </button>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() => mutations.deleteAcl.mutate(item.name)}
                >
                  Slett
                </button>
              </div>,
            ])}
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
          <p className="text-sm text-ink-muted">
            Runtime-handlinger (enable/disable/drain/weight) er ephemeral — de lagres ikke i config før du
            endrer Servers-fanen eksplisitt.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="font-mono text-xs text-ink-muted">
              Vekt (0–256)
              <input
                type="number"
                min={0}
                max={256}
                className="ml-2 w-24 border border-line bg-paper px-2 py-1"
                value={runtimeWeight}
                onChange={(e) => setRuntimeWeight(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm"
              onClick={() => void statusQuery.refetch()}
              disabled={statusQuery.isFetching}
            >
              {statusQuery.isFetching ? "Henter…" : "Oppdater status"}
            </button>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm"
              disabled={mutations.clearCounters.isPending}
              onClick={() => {
                setRuntimeMessage(null);
                mutations.clearCounters.mutate(undefined, {
                  onSuccess: (data) => {
                    setRuntimeMessage(`clear counters: ${data.output} (ephemeral)`);
                  },
                });
              }}
            >
              {mutations.clearCounters.isPending ? "Nullstiller…" : "Clear counters"}
            </button>
          </div>
          {runtimeMessage ? <p className="font-mono text-xs text-ink-muted">{runtimeMessage}</p> : null}
          {mutations.runtimeServer.isError || mutations.clearCounters.isError ? (
            <p className="text-danger">
              {(mutations.runtimeServer.error || mutations.clearCounters.error) instanceof Error
                ? ((mutations.runtimeServer.error || mutations.clearCounters.error) as Error).message
                : "Runtime-handling feilet"}
            </p>
          ) : null}
          <EntityTable
            headers={["Proxy", "Type", "Status", "Sessions", "Bytes in/out"]}
            rows={[
              ...(statusQuery.data?.frontends ?? []).map((row) => [
                row.proxy,
                "FRONTEND",
                row.status,
                row.current_sessions ?? "—",
                `${row.bytes_in ?? "—"} / ${row.bytes_out ?? "—"}`,
              ]),
              ...(statusQuery.data?.backends ?? []).map((row) => [
                row.proxy,
                "BACKEND",
                row.status,
                row.current_sessions ?? "—",
                `${row.bytes_in ?? "—"} / ${row.bytes_out ?? "—"}`,
              ]),
            ]}
          />
          <h3 className="text-sm font-medium tracking-wide text-ink-muted uppercase">Servers</h3>
          <EntityTable
            headers={["Backend", "Server", "Status", "Sessions", "Check", ""]}
            rows={(statusQuery.data?.servers ?? []).map((row) => [
              row.proxy,
              row.server,
              row.status,
              row.current_sessions ?? "—",
              row.check_status ?? "—",
              <div key={`${row.proxy}-${row.server}-rt`} className="flex flex-wrap gap-2">
                {(
                  [
                    ["enable", "Enable"],
                    ["disable", "Disable"],
                    ["drain", "Drain"],
                    ["set_weight", "Set weight"],
                  ] as const
                ).map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    className="text-accent hover:underline disabled:opacity-50"
                    disabled={mutations.runtimeServer.isPending}
                    onClick={() => {
                      setRuntimeMessage(null);
                      mutations.runtimeServer.mutate(
                        {
                          backend: row.proxy,
                          server: row.server,
                          action,
                          weight:
                            action === "set_weight"
                              ? Number(runtimeWeight) || 0
                              : undefined,
                        },
                        {
                          onSuccess: (data) => {
                            setRuntimeMessage(
                              `${data.action} ${data.backend}/${data.server}: ${data.output} (ephemeral)`,
                            );
                          },
                        },
                      );
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>,
            ])}
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
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-mono text-xs text-ink-muted">
                    Revision {revisionDetailQuery.data?.revision_number} ·{" "}
                    {revisionDetailQuery.data?.deployment_status}/
                    {revisionDetailQuery.data?.validation_status}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={`text-xs hover:underline ${revisionView === "diff" ? "text-accent" : "text-ink-muted"}`}
                      onClick={() => setRevisionView("diff")}
                    >
                      Diff
                    </button>
                    <button
                      type="button"
                      className={`text-xs hover:underline ${revisionView === "full" ? "text-accent" : "text-ink-muted"}`}
                      onClick={() => setRevisionView("full")}
                    >
                      Full config
                    </button>
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                      disabled={!revisionDetailQuery.data?.rendered_configuration}
                      onClick={() => {
                        const text = revisionDetailQuery.data?.rendered_configuration;
                        if (!text) return;
                        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = `${instance?.name || instanceId}-rev${revisionDetailQuery.data?.revision_number}.cfg`;
                        anchor.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Last ned
                    </button>
                  </div>
                </div>
                {revisionDetailQuery.data?.validation_output ? (
                  <p
                    className={`font-mono text-xs ${
                      revisionDetailQuery.data.validation_status === "valid"
                        ? "text-ok"
                        : "text-danger"
                    }`}
                  >
                    Validation: {revisionDetailQuery.data.validation_output}
                  </p>
                ) : null}
                <DiffView
                  text={
                    revisionView === "full"
                      ? revisionDetailQuery.data?.rendered_configuration
                      : revisionDetailQuery.data?.diff_from_previous ||
                        revisionDetailQuery.data?.rendered_configuration
                  }
                  emptyLabel="Ingen config"
                />
              </>
            )}
          </div>
        </section>
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

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex items-end gap-2 pt-5">{children}</div>;
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
