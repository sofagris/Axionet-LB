import { Link } from "react-router-dom";
import { useInstances } from "../features/instances/hooks";
import { useInterfaces } from "../features/interfaces/hooks";
import { useNetworks } from "../features/networks/hooks";
import { useSystemHealth, useSystemInfo } from "../features/system/hooks";
import type { ComponentHealth, HealthResponse } from "../types/system";

function statusTone(status: string): string {
  switch (status) {
    case "ok":
      return "text-ok";
    case "degraded":
      return "text-warn";
    case "error":
      return "text-danger";
    default:
      return "text-ink-muted";
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-sm font-medium uppercase ${statusTone(status)}`}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}

function ComponentRow({ name, component }: { name: string; component: ComponentHealth }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div>
        <p className="font-medium text-ink">{name}</p>
        {component.detail ? (
          <p className="mt-0.5 font-mono text-xs text-ink-muted">{component.detail}</p>
        ) : null}
      </div>
      <div className="text-right">
        <StatusPill status={component.status} />
        {component.latency_ms != null ? (
          <p className="mt-1 font-mono text-xs text-ink-muted">{component.latency_ms.toFixed(1)} ms</p>
        ) : null}
      </div>
    </div>
  );
}

function HealthPanel({ health }: { health: HealthResponse }) {
  return (
    <section className="rounded-lg border border-line bg-paper-elevated p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">System health</h2>
          <p className="text-sm text-ink-muted">
            {health.service} · v{health.version}
          </p>
        </div>
        <StatusPill status={health.status} />
      </div>
      <div>
        {Object.entries(health.components).map(([name, component]) => (
          <ComponentRow key={name} name={name} component={component} />
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-ink-muted">
        Sist sjekket {new Date(health.checked_at).toLocaleString("nb-NO")}
      </p>
    </section>
  );
}

export function DashboardPage() {
  const healthQuery = useSystemHealth();
  const infoQuery = useSystemInfo();
  const interfacesQuery = useInterfaces();
  const networksQuery = useNetworks();
  const instancesQuery = useInstances();

  const upCount =
    interfacesQuery.data?.filter((iface) => iface.link_state === "up").length ?? 0;
  const totalCount = interfacesQuery.data?.length ?? 0;
  const networkCount = networksQuery.data?.length ?? 0;
  const runningInstances =
    instancesQuery.data?.filter((item) => item.actual_state === "running").length ?? 0;
  const instanceCount = instancesQuery.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Dashboard</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Kontrollplan for AxioNet LB. Dataplan-instanser administreres under Instances.
        </p>
      </section>

      {infoQuery.data ? (
        <section className="grid gap-3 sm:grid-cols-4">
          <div className="border-l-2 border-accent pl-3">
            <p className="text-xs tracking-wide text-ink-muted uppercase">Interfaces</p>
            <p className="mt-1 font-mono text-sm">
              {interfacesQuery.isLoading ? "…" : `${upCount} up / ${totalCount}`}
            </p>
            <Link className="mt-1 inline-block text-xs text-accent hover:underline" to="/interfaces">
              Vis alle
            </Link>
          </div>
          <div className="border-l-2 border-line pl-3">
            <p className="text-xs tracking-wide text-ink-muted uppercase">Networks</p>
            <p className="mt-1 font-mono text-sm">
              {networksQuery.isLoading ? "…" : networkCount}
            </p>
            <Link className="mt-1 inline-block text-xs text-accent hover:underline" to="/networks">
              Administrer
            </Link>
          </div>
          <div className="border-l-2 border-line pl-3">
            <p className="text-xs tracking-wide text-ink-muted uppercase">Instances</p>
            <p className="mt-1 font-mono text-sm">
              {instancesQuery.isLoading ? "…" : `${runningInstances} run / ${instanceCount}`}
            </p>
            <Link className="mt-1 inline-block text-xs text-accent hover:underline" to="/instances">
              Administrer
            </Link>
          </div>
          <div className="border-l-2 border-line pl-3">
            <p className="text-xs tracking-wide text-ink-muted uppercase">Data</p>
            <p className="mt-1 font-mono text-sm">{infoQuery.data.data_dir}</p>
          </div>
        </section>
      ) : null}

      {healthQuery.isLoading ? <p className="text-ink-muted">Henter health…</p> : null}

      {healthQuery.isError ? (
        <p className="text-danger">
          Kunne ikke hente health:{" "}
          {healthQuery.error instanceof Error ? healthQuery.error.message : "ukjent feil"}
        </p>
      ) : null}

      {healthQuery.data ? <HealthPanel health={healthQuery.data} /> : null}
    </div>
  );
}
