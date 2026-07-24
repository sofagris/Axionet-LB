import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHaproxyBackends, useHaproxyFrontends } from "../haproxy/hooks";
import { instanceDetailPath } from "../../lib/instancePaths";
import type { Instance } from "../../types/instances";
import type { HaproxyBackend, HaproxyFrontend } from "../../types/haproxy";
import type { Vip } from "../../types/vips";
import type { LbMetrics } from "../../types/system";
import { PublishToDashboardModal } from "../dashboards/PublishToDashboardModal";
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

const AUTOPLAY_MS = 5000;

type Props = {
  instances: Instance[];
  vips: Vip[];
  lbMetrics: LbMetrics | undefined;
  bitRates: TrafficFlowBitRates;
  loading?: boolean;
  /** Show “Publish to dashboard” (system overview only). */
  enablePublish?: boolean;
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

function toneFromHealthClass(toneClass: string): "ok" | "warn" | "danger" | "muted" {
  if (toneClass.includes("danger")) return "danger";
  if (toneClass.includes("warn")) return "warn";
  if (toneClass.includes("ok")) return "ok";
  return "muted";
}

function FlowArrow() {
  return (
    <div
      className="hidden items-center justify-center self-center px-0.5 text-domain-traffic lg:flex"
      aria-hidden
    >
      <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
        <path
          d="M1 6h16M13 2l5 4-5 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

function Column({
  step,
  title,
  children,
}: {
  step?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 border-l border-line/80 pl-3 first:border-l-0 first:pl-0">
      <div className="flex items-baseline gap-2">
        {step ? (
          <span className="font-mono text-[10px] text-ink-muted/70 tabular-nums">{step}</span>
        ) : null}
        <p className="font-mono text-[10px] tracking-[0.14em] text-domain-traffic uppercase">
          {title}
        </p>
      </div>
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
  step,
  label,
  title,
  subtitle,
  meta,
  tone = "muted",
  map,
  to,
  primary = false,
}: {
  step: string;
  label: string;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: "ok" | "warn" | "danger" | "muted";
  map?: boolean;
  to?: string;
  /** Stronger visual weight for the path origin (Internet / VIP). */
  primary?: boolean;
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
    <div
      className={[
        "relative min-w-[7rem] flex-1 overflow-hidden border border-line bg-paper px-3 py-2.5",
        primary
          ? "border-l-[3px] border-l-domain-traffic bg-domain-traffic-soft/30"
          : "border-l-2 border-l-domain-traffic/70",
      ].join(" ")}
    >
      {map ? (
        <WorldMapBackdrop className="pointer-events-none absolute inset-0 text-domain-traffic opacity-70" />
      ) : null}
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-ink-muted/70 tabular-nums">{step}</span>
            <p
              className={[
                "font-mono tracking-wide uppercase",
                primary ? "text-[10px] text-domain-traffic" : "text-[10px] text-domain-traffic/80",
              ].join(" ")}
            >
              {label}
            </p>
          </div>
          <span className={["size-1.5 rounded-full", toneClass].join(" ")} />
        </div>
        <p
          className={[
            "mt-1 truncate font-semibold text-ink",
            primary ? "text-[15px]" : "text-sm",
          ].join(" ")}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{subtitle}</p>
        ) : null}
        {meta ? (
          <p className="mt-0.5 truncate text-[10px] text-ink-muted/80">{meta}</p>
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

function PhysicalPathStrip({ hops }: { hops: { label: string; value: string }[] }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 border border-line/80 bg-paper/80 px-3 py-2">
      <p className="font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
        {t("dashboard.trafficFlow.physicalPath")}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-ink">
        {hops.map((hop, i) => (
          <span key={`${hop.label}-${hop.value}`} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span className="text-domain-traffic/70">→</span> : null}
            <span className="text-ink-muted">{hop.label}</span>
            <span>{hop.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
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
      <Column step="01" title={t("dashboard.trafficFlow.clients")}>
        <Stat label={t("dashboard.trafficFlow.inbound")} value={formatBitRate(bitRates.rxBps)} />
        <Stat label={t("dashboard.trafficFlow.outbound")} value={formatBitRate(bitRates.txBps)} />
        <Stat
          label={t("dashboard.sessionRate")}
          value={totals ? `${totals.session_rate}/s` : "—"}
        />
      </Column>
      <FlowArrow />
      <Column step="02" title={t("dashboard.trafficFlow.cluster")}>
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
      <Column step="03" title={t("dashboard.trafficFlow.services")}>
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
      <Column step="04" title={t("dashboard.trafficFlow.backends")}>
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

  const frrDot = toneFromHealthClass(
    frr ? healthTone(frr.health_status, frr.actual_state) : "text-ink-muted",
  );
  const hapDot = toneFromHealthClass(
    hap ? healthTone(hap.health_status, hap.actual_state) : "text-ink-muted",
  );

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

  const primaryFe = frontends[0];
  const primaryBe = backends[0];
  const primarySrv = servers[0];

  const feTitle = logical
    ? frontends.length
      ? `${frontends.length} frontend${frontends.length === 1 ? "" : "s"}`
      : t("dashboard.trafficFlow.frontends")
    : primaryFe
      ? `${primaryFe.bind_address}:${primaryFe.bind_port}`
      : configLoading
        ? "…"
        : "—";
  const feSub = logical
    ? frontends
        .slice(0, 2)
        .map((f) => f.name)
        .join(", ") || (configLoading ? "…" : "—")
    : hap?.name ?? (configLoading ? "…" : "—");
  const feMeta = logical
    ? hap?.name
    : frontends.length > 1
      ? `+${frontends.length - 1} ${t("dashboard.trafficFlow.more")}`
      : primaryFe?.name;

  const beTitle = logical
    ? backends.length
      ? `${backends.length} backend${backends.length === 1 ? "" : "s"}`
      : t("dashboard.trafficFlow.backendsCfg")
    : primaryBe?.balance ?? (configLoading ? "…" : "—");
  const beSub = logical
    ? backends
        .slice(0, 2)
        .map((b) => b.name)
        .join(", ") || (configLoading ? "…" : "—")
    : primaryBe?.name ?? (configLoading ? "…" : "—");
  const beMeta = !logical && backends.length > 1
    ? `+${backends.length - 1} ${t("dashboard.trafficFlow.more")}`
    : undefined;

  const srvTitle = logical
    ? servers.length
      ? `${servers.length} server${servers.length === 1 ? "" : "s"}`
      : t("dashboard.servers")
    : primarySrv
      ? `${primarySrv.address}:${primarySrv.port}`
      : configLoading
        ? "…"
        : "—";
  const srvSub = logical
    ? slide.lbRow && slide.lbRow.servers_total > 0
      ? `${slide.lbRow.servers_up}/${slide.lbRow.servers_total} up`
      : servers
          .slice(0, 2)
          .map((s) => s.name)
          .join(", ") || (configLoading ? "…" : undefined)
    : primarySrv?.name ??
      (slide.lbRow && slide.lbRow.servers_total > 0
        ? `${slide.lbRow.servers_up}/${slide.lbRow.servers_total} up`
        : undefined);
  const srvMeta = !logical && servers.length > 1
    ? `+${servers.length - 1} ${t("dashboard.trafficFlow.more")}`
    : hapIp && !logical
      ? `via ${hapIp}`
      : undefined;

  const physicalHops = [
    { label: "VIP", value: vip.address },
    { label: "FRR", value: frrIp ?? "—" },
    {
      label: "FE",
      value: primaryFe ? `${primaryFe.bind_address}:${primaryFe.bind_port}` : hapIp ?? "—",
    },
    {
      label: "SRV",
      value: primarySrv ? `${primarySrv.address}:${primarySrv.port}` : "—",
    },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <FlowNode
          step="01"
          label={t("dashboard.trafficFlow.internet")}
          title={logical ? vip.name : vip.address}
          subtitle={
            logical
              ? `${vip.address} · ${vip.mode}`
              : vip.announce_prefix ?? vip.mode
          }
          meta={
            logical
              ? vip.advertised
                ? t("dashboard.trafficFlow.advertised")
                : t("dashboard.trafficFlow.notAdvertised")
              : vip.name
          }
          tone={vipTone}
          map
          primary
        />
        <FlowArrow />
        <FlowNode
          step="02"
          label={t("dashboard.trafficFlow.frr")}
          title={logical ? (frr?.name ?? "—") : (frrIp ?? frr?.name ?? "—")}
          subtitle={
            logical
              ? frr?.actual_state
              : frr?.name
          }
          meta={!logical ? frr?.actual_state : undefined}
          tone={frrDot}
          to={frr ? instanceDetailPath(frr.id, "frr") : undefined}
        />
        <FlowArrow />
        <FlowNode
          step="03"
          label={t("dashboard.trafficFlow.frontends")}
          title={feTitle}
          subtitle={feSub}
          meta={feMeta}
          tone={hapDot}
          to={hap ? instanceDetailPath(hap.id, "haproxy") : undefined}
        />
        <FlowArrow />
        <FlowNode
          step="04"
          label={t("dashboard.trafficFlow.backendNode")}
          title={beTitle}
          subtitle={beSub}
          meta={beMeta}
          tone={hapDot}
          to={hap ? instanceDetailPath(hap.id, "haproxy") : undefined}
        />
        <FlowArrow />
        <FlowNode
          step="05"
          label={t("dashboard.trafficFlow.servers")}
          title={srvTitle}
          subtitle={srvSub}
          meta={srvMeta}
          tone={
            slide.lbRow && slide.lbRow.servers_down > 0
              ? "danger"
              : slide.lbRow && slide.lbRow.servers_up > 0
                ? "ok"
                : hapDot
          }
        />
      </div>
      {!logical ? <PhysicalPathStrip hops={physicalHops} /> : null}
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
  enablePublish = false,
}: Props) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<FlowViewMode>("logical");
  const [advertisedOnly, setAdvertisedOnly] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const hoverRef = useRef(false);

  const slides = useMemo(
    () => buildFlowSlides({ vips, instances, lbMetrics, advertisedOnly }),
    [vips, instances, lbMetrics, advertisedOnly],
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

  useEffect(() => {
    if (!autoplay || paused || slides.length <= 1) return;
    const id = window.setInterval(() => {
      if (hoverRef.current) return;
      go(1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [autoplay, paused, slides.length, go]);

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

  const vipSlideCount = slides.filter((s) => s.kind === "vip").length;

  return (
    <section
      className="border-l-2 border-domain-traffic bg-paper-elevated/50 p-5"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
      }}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
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
          <button
            type="button"
            className={[
              "border border-line px-2.5 py-1.5 text-xs",
              advertisedOnly
                ? "bg-domain-traffic-soft text-domain-traffic"
                : "text-ink-muted hover:text-ink",
            ].join(" ")}
            onClick={() => setAdvertisedOnly((v) => !v)}
            aria-pressed={advertisedOnly}
            title={t("dashboard.trafficFlow.advertisedOnlyHint")}
          >
            {t("dashboard.trafficFlow.advertisedOnly")}
          </button>
          {enablePublish ? (
            <button
              type="button"
              className="border border-line px-2.5 py-1.5 text-xs text-ink-muted hover:border-domain-traffic hover:text-domain-traffic"
              onClick={() => setPublishOpen(true)}
            >
              {t("dashboards.publishAction")}
            </button>
          ) : null}
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
          <button
            type="button"
            className={[
              "ml-1 border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wide disabled:opacity-40",
              autoplay
                ? "bg-domain-traffic-soft text-domain-traffic"
                : "text-ink-muted hover:text-ink",
            ].join(" ")}
            onClick={() => setAutoplay((v) => !v)}
            disabled={slides.length <= 1}
            aria-pressed={autoplay}
            aria-label={
              autoplay
                ? t("dashboard.trafficFlow.autoplayPause")
                : t("dashboard.trafficFlow.autoplayPlay")
            }
          >
            {autoplay
              ? t("dashboard.trafficFlow.autoplayPause")
              : t("dashboard.trafficFlow.autoplayPlay")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-muted">
            {index + 1} / {slides.length}
            {advertisedOnly ? (
              <span className="ml-2 text-domain-traffic">
                ({vipSlideCount} {t("dashboard.trafficFlow.vipCount")})
              </span>
            ) : null}
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

      {enablePublish ? (
        <PublishToDashboardModal open={publishOpen} onClose={() => setPublishOpen(false)} />
      ) : null}
    </section>
  );
}
