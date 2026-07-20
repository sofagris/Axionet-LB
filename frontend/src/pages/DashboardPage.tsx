import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useInstances } from "../features/instances/hooks";
import { useInterfaces } from "../features/interfaces/hooks";
import { useNetworks } from "../features/networks/hooks";
import { useSystemHealth, useSystemInfo, useSystemMetrics, useLbMetrics } from "../features/system/hooks";
import { useTelemetryHistory } from "../features/telemetry/useTelemetryHistory";
import { instanceDetailPath } from "../lib/instancePaths";
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

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

function formatBitRate(bps: number | null | undefined): string {
  if (bps == null || Number.isNaN(bps)) return "—";
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbit/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbit/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} kbit/s`;
  return `${bps.toFixed(0)} bit/s`;
}

function ComponentRow({
  name,
  component,
}: {
  name: string;
  component: ComponentHealth;
}) {
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
  const { t, i18n } = useTranslation();
  const labels: Record<string, string> = {
    api: t("dashboard.api"),
    database: t("dashboard.database"),
    docker: t("dashboard.docker"),
  };
  return (
    <section className="border-l-2 border-accent bg-paper-elevated/60 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t("dashboard.health")}</h2>
          <p className="text-sm text-ink-muted">
            {health.service} · v{health.version}
          </p>
        </div>
        <StatusPill status={health.status} />
      </div>
      <div>
        {Object.entries(health.components).map(([name, component]) => (
          <ComponentRow key={name} name={labels[name] ?? name} component={component} />
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-ink-muted">
        {t("dashboard.checkedAt", {
          time: new Date(health.checked_at).toLocaleString(i18n.language === "en" ? "en-GB" : "nb-NO"),
        })}
      </p>
    </section>
  );
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-[220px] border-t border-line pt-4">
      <p className="mb-3 text-xs tracking-wide text-ink-muted uppercase">{title}</p>
      <div className="h-44 w-full">{children}</div>
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const healthQuery = useSystemHealth();
  const infoQuery = useSystemInfo();
  const metricsQuery = useSystemMetrics();
  const lbMetricsQuery = useLbMetrics();
  const interfacesQuery = useInterfaces();
  const networksQuery = useNetworks();
  const instancesQuery = useInstances();

  const history = useTelemetryHistory({
    metrics: metricsQuery.data,
    health: healthQuery.data,
    instances: instancesQuery.data,
    lbMetrics: lbMetricsQuery.data,
  });

  const chartData = history.map((point) => ({
    ...point,
    label: new Date(point.t).toLocaleTimeString(i18n.language === "en" ? "en-GB" : "nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }));
  const latestRate = history.length ? history[history.length - 1] : null;

  const upCount =
    interfacesQuery.data?.filter((iface) => iface.link_state === "up").length ?? 0;
  const totalCount = interfacesQuery.data?.length ?? 0;
  const networkCount = networksQuery.data?.length ?? 0;
  const running =
    instancesQuery.data?.filter((item) => item.actual_state === "running").length ?? 0;
  const degraded =
    instancesQuery.data?.filter((item) => item.actual_state === "degraded").length ?? 0;
  const errored =
    instancesQuery.data?.filter((item) => item.actual_state === "error").length ?? 0;
  const recentErrors =
    instancesQuery.data?.filter((item) => item.last_error).slice(0, 5) ?? [];

  const accent = "var(--ax-accent)";
  const muted = "var(--ax-ink-muted)";
  const warn = "var(--ax-warn)";

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden border-b border-line pb-8">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
          {t("dashboard.statusHero")}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              {t("common.brand")}
            </h2>
            <p className="mt-2 max-w-xl text-ink-muted">{t("dashboard.subtitle")}</p>
          </div>
          {healthQuery.data ? <StatusPill status={healthQuery.data.status} /> : null}
        </div>
        {metricsQuery.data ? (
          <p className="mt-4 font-mono text-xs text-ink-muted">
            {t("dashboard.loadAvg", {
              one: metricsQuery.data.load_avg_1?.toFixed(2) ?? "—",
              five: metricsQuery.data.load_avg_5?.toFixed(2) ?? "—",
              fifteen: metricsQuery.data.load_avg_15?.toFixed(2) ?? "—",
            })}
            {" · "}
            CPU {metricsQuery.data.cpu_percent.toFixed(1)}%
            {" · "}
            {t("dashboard.memUsed", {
              used: formatBytes(
                metricsQuery.data.mem_total_bytes - metricsQuery.data.mem_available_bytes,
              ),
              total: formatBytes(metricsQuery.data.mem_total_bytes),
            })}
          </p>
        ) : metricsQuery.isError ? (
          <p className="mt-4 text-sm text-warn">{t("dashboard.metricsUnavailable")}</p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-4 text-xs tracking-wide text-ink-muted uppercase">{t("dashboard.fleet")}</h3>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="border-l-2 border-accent pl-4">
            <p className="text-xs tracking-wide text-ink-muted uppercase">{t("dashboard.interfaces")}</p>
            <p className="mt-2 font-mono text-lg text-ink">
              {interfacesQuery.isLoading
                ? "…"
                : t("dashboard.interfacesUp", { up: upCount, total: totalCount })}
            </p>
            <Link className="mt-2 inline-block text-xs text-accent hover:underline" to="/interfaces">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          <div className="border-l-2 border-line pl-4">
            <p className="text-xs tracking-wide text-ink-muted uppercase">{t("dashboard.networks")}</p>
            <p className="mt-2 font-mono text-lg text-ink">
              {networksQuery.isLoading ? "…" : networkCount}
            </p>
            <Link className="mt-2 inline-block text-xs text-accent hover:underline" to="/networks">
              {t("dashboard.manage")}
            </Link>
          </div>
          <div className="border-l-2 border-line pl-4">
            <p className="text-xs tracking-wide text-ink-muted uppercase">{t("dashboard.instances")}</p>
            <p className="mt-2 font-mono text-sm text-ink">
              {instancesQuery.isLoading
                ? "…"
                : t("dashboard.instancesByState", { running, degraded, error: errored })}
            </p>
            <Link className="mt-2 inline-block text-xs text-accent hover:underline" to="/instances">
              {t("dashboard.manage")}
            </Link>
          </div>
        </div>
        {infoQuery.data ? (
          <p className="mt-4 font-mono text-xs text-ink-muted">data · {infoQuery.data.data_dir}</p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-xs tracking-wide text-ink-muted uppercase">
          {t("dashboard.telemetry")}
        </h3>
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <ChartFrame title={t("dashboard.cpu")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--ax-line)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} hide />
                <YAxis domain={[0, 100]} tick={{ fill: muted, fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    background: "var(--ax-paper-elevated)",
                    border: "1px solid var(--ax-line)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  name="CPU %"
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame title={t("dashboard.memory")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--ax-line)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} hide />
                <YAxis domain={[0, 100]} tick={{ fill: muted, fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    background: "var(--ax-paper-elevated)",
                    border: "1px solid var(--ax-line)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="mem"
                  name="Mem %"
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame title={t("dashboard.latency")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--ax-line)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} hide />
                <YAxis tick={{ fill: muted, fontSize: 10 }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--ax-paper-elevated)",
                    border: "1px solid var(--ax-line)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Line
                  type="monotone"
                  dataKey="dbLatency"
                  name="DB"
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="dockerLatency"
                  name="Docker"
                  stroke={warn}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame title={t("dashboard.networkThroughput")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--ax-line)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} hide />
                <YAxis
                  tick={{ fill: muted, fontSize: 10 }}
                  width={44}
                  tickFormatter={(value: number) =>
                    value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(0)}k` : `${value}`
                  }
                />
                <Tooltip
                  formatter={(value: number | string) => formatBitRate(Number(value))}
                  contentStyle={{
                    background: "var(--ax-paper-elevated)",
                    border: "1px solid var(--ax-line)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Line
                  type="monotone"
                  dataKey="rxBps"
                  name={t("dashboard.rx")}
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="txBps"
                  name={t("dashboard.tx")}
                  stroke={warn}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame title={t("dashboard.lbSessions")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--ax-line)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} hide />
                <YAxis tick={{ fill: muted, fontSize: 10 }} width={36} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--ax-paper-elevated)",
                    border: "1px solid var(--ax-line)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name={t("dashboard.currentSessions")}
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="sessionRate"
                  name={t("dashboard.sessionRate")}
                  stroke={warn}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartFrame title={t("dashboard.lbThroughput")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--ax-line)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: muted, fontSize: 10 }} hide />
                <YAxis
                  tick={{ fill: muted, fontSize: 10 }}
                  width={44}
                  tickFormatter={(value: number) =>
                    value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(0)}k` : `${value}`
                  }
                />
                <Tooltip
                  formatter={(value: number | string) => formatBitRate(Number(value))}
                  contentStyle={{
                    background: "var(--ax-paper-elevated)",
                    border: "1px solid var(--ax-line)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Line
                  type="monotone"
                  dataKey="lbRxBps"
                  name={t("dashboard.rx")}
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="lbTxBps"
                  name={t("dashboard.tx")}
                  stroke={warn}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>
        {metricsQuery.data?.network ? (
          <p className="mt-3 font-mono text-xs text-ink-muted">
            Σ {t("dashboard.rx")} {formatBytes(metricsQuery.data.network.rx_bytes)}
            {" · "}
            Σ {t("dashboard.tx")} {formatBytes(metricsQuery.data.network.tx_bytes)}
            {" · "}
            {t("dashboard.errors")}{" "}
            {metricsQuery.data.network.rx_errors + metricsQuery.data.network.tx_errors}
            {" · "}
            {t("dashboard.dropped")}{" "}
            {metricsQuery.data.network.rx_dropped + metricsQuery.data.network.tx_dropped}
            {latestRate ? (
              <>
                {" · "}
                now RX {formatBitRate(latestRate.rxBps)} / TX {formatBitRate(latestRate.txBps)}
              </>
            ) : null}
          </p>
        ) : null}
        {lbMetricsQuery.data ? (
          <p className="mt-2 font-mono text-xs text-ink-muted">
            LB · {t("dashboard.currentSessions")} {lbMetricsQuery.data.totals.current_sessions}
            {" · "}
            {t("dashboard.sessionRate")} {lbMetricsQuery.data.totals.session_rate}/s
            {" · "}
            {t("dashboard.servers")} {lbMetricsQuery.data.totals.servers_up}/
            {lbMetricsQuery.data.totals.servers_total} up
            {" · "}
            Σ in {formatBytes(lbMetricsQuery.data.totals.bytes_in)} / out{" "}
            {formatBytes(lbMetricsQuery.data.totals.bytes_out)}
            {" · "}
            {t("dashboard.instances")} {lbMetricsQuery.data.totals.instances_available}/
            {lbMetricsQuery.data.totals.instances_total}
          </p>
        ) : lbMetricsQuery.isError ? (
          <p className="mt-2 text-sm text-warn">{t("dashboard.lbMetricsUnavailable")}</p>
        ) : null}
      </section>

      <section className="border-l-2 border-line bg-paper-elevated/40 p-5">
        <h3 className="text-lg font-semibold text-ink">{t("dashboard.lbInstances")}</h3>
        {(lbMetricsQuery.data?.instances.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">{t("dashboard.noLbInstances")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.instance")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.currentSessions")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.sessionRate")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.rx")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.tx")}</th>
                  <th className="pb-2 font-medium">{t("dashboard.servers")}</th>
                </tr>
              </thead>
              <tbody>
                {(lbMetricsQuery.data?.instances ?? []).map((item) => (
                  <tr key={item.instance_id} className="border-t border-line font-mono text-xs">
                    <td className="py-2 pr-4">
                      <Link
                        to={instanceDetailPath(item.instance_id, "haproxy")}
                        className="text-accent hover:underline"
                      >
                        {item.name}
                      </Link>
                      {!item.available ? (
                        <span className="ml-2 text-warn">{t("dashboard.unavailable")}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">{item.available ? item.current_sessions : "—"}</td>
                    <td className="py-2 pr-4">{item.available ? `${item.session_rate}/s` : "—"}</td>
                    <td className="py-2 pr-4">{item.available ? formatBytes(item.bytes_in) : "—"}</td>
                    <td className="py-2 pr-4">{item.available ? formatBytes(item.bytes_out) : "—"}</td>
                    <td className="py-2">
                      {item.available ? `${item.servers_up}/${item.servers_total}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-l-2 border-line bg-paper-elevated/40 p-5">
        <h3 className="text-lg font-semibold text-ink">{t("dashboard.networkInterfaces")}</h3>
        {(metricsQuery.data?.interfaces?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">{t("dashboard.noInterfaces")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Link</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.rx")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.tx")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("dashboard.errors")}</th>
                  <th className="pb-2 font-medium">{t("dashboard.dropped")}</th>
                </tr>
              </thead>
              <tbody>
                {(metricsQuery.data?.interfaces ?? []).map((iface) => (
                  <tr key={iface.name} className="border-t border-line font-mono text-xs">
                    <td className="py-2 pr-4 text-ink">{iface.name}</td>
                    <td className={`py-2 pr-4 uppercase ${statusTone(iface.link_state === "up" ? "ok" : "degraded")}`}>
                      {iface.link_state}
                    </td>
                    <td className="py-2 pr-4">{formatBytes(iface.rx_bytes)}</td>
                    <td className="py-2 pr-4">{formatBytes(iface.tx_bytes)}</td>
                    <td className="py-2 pr-4">
                      {iface.rx_errors}/{iface.tx_errors}
                    </td>
                    <td className="py-2">
                      {iface.rx_dropped}/{iface.tx_dropped}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {healthQuery.isLoading ? <p className="text-ink-muted">{t("dashboard.healthLoading")}</p> : null}
        {healthQuery.isError ? (
          <p className="text-danger">
            {t("dashboard.healthError", {
              message:
                healthQuery.error instanceof Error
                  ? healthQuery.error.message
                  : t("common.unknownError"),
            })}
          </p>
        ) : null}
        {healthQuery.data ? <HealthPanel health={healthQuery.data} /> : null}

        <section className="border-l-2 border-line bg-paper-elevated/40 p-5">
          <h2 className="text-lg font-semibold text-ink">{t("dashboard.recentErrors")}</h2>
          {recentErrors.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">{t("dashboard.noErrors")}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentErrors.map((item) => (
                <li key={item.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                  <Link
                    to={instanceDetailPath(item.id, item.service_type)}
                    className="font-medium text-accent hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 font-mono text-xs text-danger">{item.last_error}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
