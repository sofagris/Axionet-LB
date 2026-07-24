import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHaproxyBackends, useHaproxyFrontends } from "../haproxy/hooks";
import { instanceDetailPath } from "../../lib/instancePaths";
import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import type { HaproxyBackend, HaproxyFrontend } from "../../types/haproxy";
import type { LbMetrics } from "../../types/system";
import {
  buildFlowSlides,
  haproxyAttachmentIp,
  type FlowSlide,
} from "./buildFlowSlides";
import { WorldMapBackdrop } from "./WorldMapBackdrop";

export type TrafficFlowBitRates = {
  rxBps: number | null;
  txBps: number | null;
};

export type FlowViewMode = "logical" | "physical";

type Props = {
  instances: Instance[];
  vips: Vip[];
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
  if (health === "healthy") return "text-ok";
  return "text-ink-muted";
}

function FlowArrow() {
  return (
    <div
      className="hidden items-center justify-center self-center px-1 text-domain-traffic lg:flex"
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

function Column({ title, children }: { title: string; children: ReactNode }) {
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

function FlowNode({
  label,
  title,
  subtitle,
  tone = "muted",
  map,
  to,
}: {
  label: string;
  title: string;
  subtitle?: string;
  tone?: "ok" | "warn" | "danger" | "muted";
  map?: boolean;
  to?: string;
}) {
  const toneClass =
    tone === "ok"
      ? "bg-ok"
      : tone === "warn"
        ? "bg-warn"
        : tone === "danger"
          ? "bg-danger"
          : "bg-ink-muted";

  const body = (
    <div className="relative min-w-[7.5rem] flex-1 overflow-hidden border border-line border-l-2 border-l-domain-traffic bg-paper px-3 py-2.5">
      {map ? (
        <WorldMapBackdrop className="pointer-events-none absolute inset-0 text-domain-traffic opacity-70" />
      ) : null}
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] tracking-wide text-domain-traffic uppercase">
            {label}
          </p>
          <span className={["size-1.5 rounded-full", toneClass].join(" ")} />
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-ink">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block min-w-0 flex-1 hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}

function FleetBody({
  instances,
  lbMetrics,
  bitRates,
}: {
  instances: Instance[];
  lbMetrics: LbMetrics | undefined;
  bitRates: TrafficFlowBitRates;
}) {
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

  if (haproxy.length === 0) {
    return (
      <div>
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
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:gap-0">
      <Column title={t("dashboard.trafficFlow.clients")}>
        <Stat label={t("dashboard.trafficFlow.inbound")} value={formatBitRate(bitRates.rxBps)} />
        <Stat label={t("dashboard.trafficFlow.outbound")} value={formatBitRate(bitRates.txBps)} />
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
          value={totals ? `${totals.servers_up}/${totals.servers_total}` : "—"}
        />
        <div className="pt-1">
          <p className="text-[11px] text-ink-muted">{t("dashboard.trafficFlow.serverHealth")}</p>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-sm bg-line/60">
            {totals && totals.servers_total > 0 ? (
              <>
                <div
                  className="bg-ok"
                  style={{ width: `${(totals.servers_up / totals.servers_total) * 100}%` }}
                />
                <div
                  className="bg-danger"
                  style={{ width: `${(totals.servers_down / totals.servers_total) * 100}%` }}
                />
              </>
            ) : (
              <div className="w-full bg-line" />
            )}
          </div>
        </div>
      </Column>
    </div>
  );
}

function VipFlowBody({
  slide,
  viewMode,
  frontends,
  backends,
  configLoading,
}: {
  slide: FlowSlide;
  viewMode: FlowViewMode;
  frontends: HaproxyFrontend[];
  backends: HaproxyBackend[];
  configLoading: boolean;
}) {
  const { t } = useTranslation();
  const vip = slide.vip!;
  const frr = slide.frr;
  const hap = slide.haproxy;
  const logical = viewMode === "logical";

  const frrTone = frr
    ? healthTone(frr.health_status, frr.actual_state)
    : "text-ink-muted";
  const frrDot =
    frrTone.includes("danger")
      ? "danger"
      : frrTone.includes("warn")
        ? "warn"
        : frrTone.includes("ok")
          ? "ok"
          : "muted";

  const hapTone = hap
    ? healthTone(hap.health_status, hap.actual_state)
    : "text-ink-muted";
  const hapDot =
    hapTone.includes("danger")
      ? "danger"
      : hapTone.includes("warn")
        ? "warn"
        : hapTone.includes("ok")
          ? "ok"
          : "muted";

  const vipTone =
    vip.enabled && (vip.advertised || vip.dataplane_ready || vip.attached)
      ? "ok"
      : vip.enabled
        ? "warn"
        : "muted";

  const servers = backends.flatMap((b) =>
    b.servers.map((s) => ({ ...s, backend: b.name })),
  );
  const hapIp = haproxyAttachmentIp(hap, vip.network_id);
  const frrIp = haproxyAttachmentIp(frr, vip.network_id);

  const feTitle = logical
    ? frontends.length
      ? `${frontends.length} frontend${frontends.length === 1 ? "" : "s"}`
      : t("dashboard.trafficFlow.frontends")
    : frontends[0]
      ? `${frontends[0].bind_address}:${frontends[0].bind_port}`
      : "—";
  const feSub = logical
    ? frontends
        .slice(0, 2)
        .map((f) => f.name)
        .join(", ") || (configLoading ? "…" : "—")
    : frontends
        .slice(0, 2)
        .map((f) => f.name)
        .join(", ") || undefined;

  const beTitle = logical
    ? backends.length
      ? `${backends.length} backend${backends.length === 1 ? "" : "s"}`
      : t("dashboard.trafficFlow.backendsCfg")
    : backends[0]?.balance ?? "—";
  const beSub = logical
    ? backends
        .slice(0, 2)
        .map((b) => b.name)
        .join(", ") || (configLoading ? "…" : "—")
    : backends
        .slice(0, 2)
        .map((b) => b.name)
        .join(", ") || undefined;

  const srvTitle = logical
    ? servers.length
      ? `${servers.length} server${servers.length === 1 ? "" : "s"}`
      : t("dashboard.servers")
    : servers[0]
      ? `${servers[0].address}:${servers[0].port}`
      : "—";
  const srvSub =
    slide.lbRow && slide.lbRow.servers_total > 0
      ? `${slide.lbRow.servers_up}/${slide.lbRow.servers_total} up`
      : servers
          .slice(0, 2)
          .map((s) => s.name)
          .join(", ") || (configLoading ? "…" : undefined);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <FlowNode
        label={t("dashboard.trafficFlow.internet")}
        title={logical ? t("dashboard.trafficFlow.internet") : vip.address}
        subtitle={
          logical
            ? `${vip.address} · ${vip.mode}`
            : vip.announce_prefix ?? vip.mode
        }
        tone={vipTone}
        map
      />
      <FlowArrow />
      <FlowNode
        label={t("dashboard.trafficFlow.frr")}
        title={logical ? t("dashboard.trafficFlow.frr") : (frr?.name ?? "—")}
        subtitle={
          logical
            ? frr?.name
            : frrIp ?? frr?.actual_state
        }
        tone={frrDot}
        to={frr ? instanceDetailPath(frr.id, "frr") : undefined}
      />
      <FlowArrow />
      <FlowNode
        label={t("dashboard.trafficFlow.frontends")}
        title={feTitle}
        subtitle={feSub}
        tone={hapDot}
        to={hap ? instanceDetailPath(hap.id, "haproxy") : undefined}
      />
      <FlowArrow />
      <FlowNode
        label={t("dashboard.trafficFlow.backendNode")}
        title={beTitle}
        subtitle={beSub}
        tone={hapDot}
        to={hap ? instanceDetailPath(hap.id, "haproxy") : undefined}
      />
      <FlowArrow />
      <FlowNode
        label={t("dashboard.trafficFlow.servers")}
        title={srvTitle}
        subtitle={
          logical
            ? srvSub
            : hapIp
              ? `via ${hapIp}`
              : srvSub
        }
        tone={
          slide.lbRow && slide.lbRow.servers_down > 0
            ? "danger"
            : slide.lbRow && slide.lbRow.servers_up > 0
              ? "ok"
              : hapDot
        }
      />
    </div>
  );
}

/** Props-driven traffic flow — fleet aggregate + VIP carousel. */
export function TrafficFlowCard({
  instances,
  vips,
  lbMetrics,
  bitRates,
  loading,
}: Props) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<FlowViewMode>("logical");
  const [index, setIndex] = useState(0);

  const slides = useMemo(
    () => buildFlowSlides({ vips, instances, lbMetrics }),
    [vips, instances, lbMetrics],
  );

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const active = slides[Math.min(index, Math.max(slides.length - 1, 0))] ?? slides[0];
  const vipActive = active?.kind === "vip";
  const hapId = vipActive ? (active.haproxy?.id ?? "") : "";

  const frontendsQuery = useHaproxyFrontends(hapId, vipActive && Boolean(hapId));
  const backendsQuery = useHaproxyBackends(hapId, vipActive && Boolean(hapId));

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => {
        const next = current + delta;
        if (next < 0) return slides.length - 1;
        if (next >= slides.length) return 0;
        return next;
      });
    },
    [slides.length],
  );

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  };

  return (
    <section
      className="border-l-2 border-domain-traffic bg-paper-elevated/50 p-5"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={t("dashboard.trafficFlow.title")}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-domain-traffic uppercase">
            {t("dashboard.trafficFlow.eyebrow")}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{t("dashboard.trafficFlow.title")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {t("dashboard.trafficFlow.subtitleV2")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-line text-xs">
            <button
              type="button"
              className={[
                "px-2.5 py-1.5",
                viewMode === "logical"
                  ? "bg-domain-traffic-soft text-domain-traffic"
                  : "text-ink-muted hover:text-ink",
              ].join(" ")}
              onClick={() => setViewMode("logical")}
            >
              {t("dashboard.trafficFlow.logical")}
            </button>
            <button
              type="button"
              className={[
                "border-l border-line px-2.5 py-1.5",
                viewMode === "physical"
                  ? "bg-domain-traffic-soft text-domain-traffic"
                  : "text-ink-muted hover:text-ink",
              ].join(" ")}
              onClick={() => setViewMode("physical")}
            >
              {t("dashboard.trafficFlow.physical")}
            </button>
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
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border border-line px-2 py-1 font-mono text-xs text-ink hover:border-domain-traffic disabled:opacity-40"
            onClick={() => go(-1)}
            disabled={slides.length <= 1}
            aria-label={t("dashboard.trafficFlow.prev")}
          >
            ‹
          </button>
          <p className="min-w-[8rem] text-center text-sm font-medium text-ink">
            {active?.kind === "fleet"
              ? t("dashboard.trafficFlow.fleetSlide")
              : active?.title}
          </p>
          <button
            type="button"
            className="border border-line px-2 py-1 font-mono text-xs text-ink hover:border-domain-traffic disabled:opacity-40"
            onClick={() => go(1)}
            disabled={slides.length <= 1}
            aria-label={t("dashboard.trafficFlow.next")}
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-muted">
            {index + 1} / {slides.length}
          </span>
          <div className="flex gap-1">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={[
                  "size-1.5 rounded-full",
                  i === index ? "bg-domain-traffic" : "bg-line",
                ].join(" ")}
                aria-label={slide.title}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-ink-muted">{t("common.loading")}</p>
        ) : active?.kind === "vip" ? (
          <VipFlowBody
            slide={active}
            viewMode={viewMode}
            frontends={frontendsQuery.data ?? []}
            backends={backendsQuery.data ?? []}
            configLoading={frontendsQuery.isLoading || backendsQuery.isLoading}
          />
        ) : (
          <FleetBody instances={instances} lbMetrics={lbMetrics} bitRates={bitRates} />
        )}
      </div>
    </section>
  );
}
