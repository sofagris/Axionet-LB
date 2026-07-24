import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { instanceDetailPath } from "../../lib/instancePaths";
import type { Instance } from "../../types/instances";
import type { LbMetrics } from "../../types/system";

export type TrafficFlowBitRates = {
  rxBps: number | null;
  txBps: number | null;
};

type Props = {
  instances: Instance[];
  lbMetrics: LbMetrics | undefined;
  bitRates: TrafficFlowBitRates;
  loading?: boolean;
};

function formatBitRate(bps: number | null | undefined): string {
  if (bps == null || Number.isNaN(bps)) return "—";
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbit/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbit/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} kbit/s`;
  return `${bps.toFixed(0)} bit/s`;
}

function healthTone(health: string, state: string): string {
  if (state === "error" || health === "unhealthy") return "text-danger";
  if (state === "degraded" || state === "pending") return "text-warn";
  if (state === "running" && health === "healthy") return "text-ok";
  if (state === "running") return "text-ok";
  return "text-ink-muted";
}

function FlowArrow() {
  return (
    <div
      className="hidden items-center justify-center self-center px-1 text-domain-traffic xl:flex"
      aria-hidden
    >
      <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
        <path
          d="M1 6h22M18 2l5 4-5 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Column({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 border-l border-line/80 pl-3 first:border-l-0 first:pl-0">
      <p className="font-mono text-[10px] tracking-[0.14em] text-domain-traffic uppercase">
        {title}
      </p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

/** Props-driven fleet traffic flow — reusable for future configurable dashboards. */
export function TrafficFlowCard({ instances, lbMetrics, bitRates, loading }: Props) {
  const { t } = useTranslation();
  const haproxy = instances.filter((item) => item.service_type === "haproxy");
  const totals = lbMetrics?.totals;
  const frontendCount = (lbMetrics?.instances ?? []).reduce(
    (sum, row) => sum + row.frontend_count,
    0,
  );
  const backendCount = (lbMetrics?.instances ?? []).reduce(
    (sum, row) => sum + row.backend_count,
    0,
  );

  return (
    <section className="border-l-2 border-domain-traffic bg-paper-elevated/50 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-domain-traffic uppercase">
            {t("dashboard.trafficFlow.eyebrow")}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{t("dashboard.trafficFlow.title")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {t("dashboard.trafficFlow.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 font-mono text-[10px] text-ink-muted uppercase">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-4 bg-domain-traffic" aria-hidden />
            {t("dashboard.trafficFlow.legendFlow")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden />
            {t("dashboard.trafficFlow.legendHealth")}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-muted">{t("common.loading")}</p>
      ) : haproxy.length === 0 ? (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">{t("dashboard.trafficFlow.empty")}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link to="/instances" className="text-domain-traffic hover:underline">
              {t("dashboard.manage")}
            </Link>
            <Link to="/catalog" className="text-domain-traffic hover:underline">
              {t("nav.catalog")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4 border-t border-line pt-4 xl:flex-row xl:items-stretch xl:gap-0">
          <Column title={t("dashboard.trafficFlow.clients")}>
            <Stat
              label={t("dashboard.trafficFlow.inbound")}
              value={formatBitRate(bitRates.rxBps)}
            />
            <Stat
              label={t("dashboard.trafficFlow.outbound")}
              value={formatBitRate(bitRates.txBps)}
            />
            <Stat
              label={t("dashboard.sessionRate")}
              value={totals ? `${totals.session_rate}/s` : "—"}
            />
          </Column>

          <FlowArrow />

          <Column title={t("dashboard.trafficFlow.cluster")}>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {haproxy.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    to={instanceDetailPath(item.id, "haproxy")}
                    className="truncate font-medium text-ink hover:text-domain-traffic hover:underline"
                  >
                    {item.name}
                  </Link>
                  <span
                    className={[
                      "shrink-0 font-mono text-[10px] uppercase",
                      healthTone(item.health_status, item.actual_state),
                    ].join(" ")}
                  >
                    {item.actual_state === "running" ? item.health_status : item.actual_state}
                  </span>
                </li>
              ))}
            </ul>
            {haproxy.length > 8 ? (
              <p className="font-mono text-[11px] text-ink-muted">
                +{haproxy.length - 8} {t("dashboard.trafficFlow.more")}
              </p>
            ) : null}
            <Link to="/instances" className="inline-block text-xs text-domain-traffic hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </Column>

          <FlowArrow />

          <Column title={t("dashboard.trafficFlow.services")}>
            <Stat
              label={t("dashboard.trafficFlow.haproxyNodes")}
              value={
                totals
                  ? `${totals.instances_available}/${totals.instances_total}`
                  : String(haproxy.filter((i) => i.actual_state === "running").length)
              }
            />
            <Stat
              label={t("dashboard.trafficFlow.frontends")}
              value={frontendCount > 0 ? String(frontendCount) : "—"}
            />
            <Stat
              label={t("dashboard.currentSessions")}
              value={totals ? String(totals.current_sessions) : "—"}
            />
            <Stat
              label={t("dashboard.trafficFlow.backendsCfg")}
              value={backendCount > 0 ? String(backendCount) : "—"}
            />
          </Column>

          <FlowArrow />

          <Column title={t("dashboard.trafficFlow.backends")}>
            <Stat
              label={t("dashboard.servers")}
              value={
                totals
                  ? `${totals.servers_up}/${totals.servers_total}`
                  : "—"
              }
            />
            <div className="pt-1">
              <p className="text-[11px] text-ink-muted">{t("dashboard.trafficFlow.serverHealth")}</p>
              <div className="mt-1.5 flex h-2 overflow-hidden rounded-sm bg-line/60">
                {totals && totals.servers_total > 0 ? (
                  <>
                    <div
                      className="bg-ok"
                      style={{
                        width: `${(totals.servers_up / totals.servers_total) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-danger"
                      style={{
                        width: `${(totals.servers_down / totals.servers_total) * 100}%`,
                      }}
                    />
                  </>
                ) : (
                  <div className="w-full bg-line" />
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-ink-muted">
                {totals
                  ? t("dashboard.trafficFlow.upDown", {
                      up: totals.servers_up,
                      down: totals.servers_down,
                    })
                  : "—"}
              </p>
            </div>
          </Column>
        </div>
      )}
    </section>
  );
}
