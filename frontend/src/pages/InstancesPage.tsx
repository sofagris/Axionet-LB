import { Link } from "react-router-dom";
import { useMemo, useState, type FormEvent } from "react";
import {
  useCreateInstance,
  useInstanceAction,
  useInstanceLogs,
  useInstances,
} from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";
import type { Instance } from "../types/instances";

function stateTone(state: string): string {
  if (state === "running" || state === "healthy") return "text-ok";
  if (state === "error" || state === "unhealthy") return "text-danger";
  if (state === "starting" || state === "stopping" || state === "degraded") return "text-warn";
  return "text-ink-muted";
}

function formatAttachments(instance: Instance): string {
  if (!instance.networks.length) return "—";
  return instance.networks
    .map((item) => item.ip_address || "(dhcp)")
    .join(", ");
}

export function InstancesPage() {
  const instancesQuery = useInstances();
  const networksQuery = useNetworks();
  const createMutation = useCreateInstance();
  const actionMutation = useInstanceAction();

  const [name, setName] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [desiredRunning, setDesiredRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const logsQuery = useInstanceLogs(selectedId);

  const networks = useMemo(() => networksQuery.data ?? [], [networksQuery.data]);
  const selectedNetwork = networks.find((item) => item.id === networkId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const created = await createMutation.mutateAsync({
      name,
      service_type: "haproxy",
      desired_state: desiredRunning ? "running" : "stopped",
      networks: networkId
        ? [{ network_id: networkId, ip_address: ipAddress.trim() || null }]
        : [],
    });
    setName("");
    setIpAddress("");
    setSelectedId(created.id);
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Service instances</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Flere HAProxy-containere kan bruke samme port på separate IP-er. Angi VIP/IP per
          nettverkstilknytning.
        </p>
      </section>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-lg border border-line bg-paper-elevated p-5 shadow-sm md:grid-cols-2"
      >
        <label className="block text-sm">
          <span className="text-ink-muted">Navn</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
            placeholder="edge-haproxy-1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Nettverk</span>
          <select
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
          >
            <option value="">Ingen (default bridge)</option>
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name} ({network.network_type}
                {network.subnet ? ` · ${network.subnet}` : ""})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-ink-muted">
            Statisk IP / VIP
            {selectedNetwork?.subnet ? ` (subnet ${selectedNetwork.subnet})` : ""}
          </span>
          <input
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            disabled={!networkId}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm disabled:opacity-50"
            placeholder={selectedNetwork?.gateway ? selectedNetwork.gateway.replace(/\.\d+$/, ".10") : "172.30.60.10"}
          />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={desiredRunning}
            onChange={(e) => setDesiredRunning(e.target.checked)}
          />
          Start umiddelbart (desired_state=running)
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createMutation.isPending ? "Oppretter…" : "Opprett HAProxy"}
          </button>
          {createMutation.isError ? (
            <p className="mt-2 text-sm text-danger">
              {createMutation.error instanceof Error ? createMutation.error.message : "Feil"}
            </p>
          ) : null}
        </div>
      </form>

      {instancesQuery.data ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper-elevated p-4 shadow-sm">
          {instancesQuery.data.length === 0 ? (
            <p className="text-ink-muted">Ingen instanser ennå.</p>
          ) : (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">IP / VIP</th>
                  <th className="pb-2 pr-4 font-medium">Desired</th>
                  <th className="pb-2 pr-4 font-medium">Actual</th>
                  <th className="pb-2 pr-4 font-medium">Health</th>
                  <th className="pb-2 pr-4 font-medium">Container</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instancesQuery.data.map((instance) => (
                  <InstanceRow
                    key={instance.id}
                    instance={instance}
                    selected={selectedId === instance.id}
                    busy={actionMutation.isPending}
                    onSelect={() => setSelectedId(instance.id)}
                    onAction={(action) => actionMutation.mutate({ id: instance.id, action })}
                  />
                ))}
              </tbody>
            </table>
          )}
          {actionMutation.isError ? (
            <p className="mt-3 text-sm text-danger">
              {actionMutation.error instanceof Error ? actionMutation.error.message : "Feil"}
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedId ? (
        <section className="rounded-lg border border-line bg-paper-elevated p-4 shadow-sm">
          <h3 className="font-semibold text-ink">Container logs</h3>
          <p className="mt-1 font-mono text-xs text-ink-muted">{selectedId}</p>
          <pre className="mt-3 max-h-80 overflow-auto bg-ink px-3 py-3 font-mono text-xs text-paper">
            {logsQuery.isLoading
              ? "Henter logger…"
              : logsQuery.data?.logs || "(ingen logger)"}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

function InstanceRow({
  instance,
  selected,
  busy,
  onSelect,
  onAction,
}: {
  instance: Instance;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onAction: (action: "start" | "stop" | "restart" | "delete") => void;
}) {
  return (
    <tr className={`border-t border-line align-top ${selected ? "bg-accent-soft/40" : ""}`}>
      <td className="py-3 pr-4">
        <button type="button" className="font-medium hover:underline" onClick={onSelect}>
          {instance.name}
        </button>
        <div className="mt-1">
          <Link
            className="font-mono text-xs text-accent hover:underline"
            to={`/instances/${instance.id}/haproxy`}
          >
            HAProxy config
          </Link>
        </div>
        {instance.last_error ? (
          <p className="mt-1 max-w-xs truncate font-mono text-xs text-danger">{instance.last_error}</p>
        ) : null}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-ink-muted">{formatAttachments(instance)}</td>
      <td className={`py-3 pr-4 font-mono text-xs uppercase ${stateTone(instance.desired_state)}`}>
        {instance.desired_state}
      </td>
      <td className={`py-3 pr-4 font-mono text-xs uppercase ${stateTone(instance.actual_state)}`}>
        {instance.actual_state}
      </td>
      <td className={`py-3 pr-4 font-mono text-xs uppercase ${stateTone(instance.health_status)}`}>
        {instance.health_status}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
        {instance.container_name ?? "—"}
      </td>
      <td className="py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="text-xs text-accent hover:underline"
            onClick={() => onAction("start")}
          >
            Start
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={() => onAction("stop")}
          >
            Stop
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={() => onAction("restart")}
          >
            Restart
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-danger hover:underline"
            onClick={() => onAction("delete")}
          >
            Slett
          </button>
        </div>
      </td>
    </tr>
  );
}
