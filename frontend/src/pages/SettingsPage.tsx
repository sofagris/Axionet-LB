import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useCapabilities,
  useOrphans,
  usePruneOrphans,
  useSystemHealth,
  useSystemInfo,
} from "../features/system/hooks";
import type { ComponentHealth, OrphanReport } from "../types/system";

function statusTone(status: string): string {
  if (status === "ok") return "text-ok";
  if (status === "degraded" || status === "unavailable") return "text-warn";
  if (status === "error") return "text-danger";
  return "text-ink-muted";
}

export function SettingsPage() {
  const { t } = useTranslation();
  const infoQuery = useSystemInfo();
  const healthQuery = useSystemHealth();
  const capsQuery = useCapabilities();
  const orphansQuery = useOrphans();
  const pruneMutation = usePruneOrphans();

  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());

  const info = infoQuery.data;
  const health = healthQuery.data;
  const caps = capsQuery.data;
  const orphans = orphansQuery.data;

  const orphanCount = useMemo(() => {
    if (!orphans) return 0;
    return orphans.orphan_containers.length + orphans.orphan_networks.length;
  }, [orphans]);

  const missingCount = useMemo(() => {
    if (!orphans) return 0;
    return orphans.missing_containers.length + orphans.missing_networks.length;
  }, [orphans]);

  function toggleContainer(id: string) {
    setSelectedContainers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleNetwork(id: string) {
    setSelectedNetworks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPrunable(report: OrphanReport) {
    setSelectedContainers(new Set(report.orphan_containers.filter((c) => c.prunable).map((c) => c.id)));
    setSelectedNetworks(new Set(report.orphan_networks.filter((n) => n.prunable).map((n) => n.id)));
  }

  async function handlePrune() {
    if (selectedContainers.size === 0 && selectedNetworks.size === 0) return;
    const confirmed = window.confirm(t("settings.orphansConfirm"));
    if (!confirmed) return;
    await pruneMutation.mutateAsync({
      container_ids: [...selectedContainers],
      network_ids: [...selectedNetworks],
    });
    setSelectedContainers(new Set());
    setSelectedNetworks(new Set());
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("settings.title")}</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("settings.subtitle")}</p>
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <h3 className="font-semibold text-ink">{t("settings.systemInfo")}</h3>
        {infoQuery.isLoading ? <p className="mt-3 text-ink-muted">{t("common.loading")}</p> : null}
        {infoQuery.isError ? (
          <p className="mt-3 text-sm text-danger">
            {infoQuery.error instanceof Error ? infoQuery.error.message : t("common.unknownError")}
          </p>
        ) : null}
        {info ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <InfoRow label={t("settings.name")} value={info.name} />
            <InfoRow label={t("settings.version")} value={info.version} />
            <InfoRow label={t("settings.apiPrefix")} value={info.api_prefix} mono />
            <InfoRow label={t("settings.dataDir")} value={info.data_dir} mono />
            <InfoRow
              label={t("settings.database")}
              value={info.database_configured ? t("settings.configured") : t("settings.missing")}
            />
            <InfoRow
              label={t("settings.docker")}
              value={info.docker_configured ? t("settings.configured") : t("settings.missing")}
            />
            <InfoRow
              label={t("settings.mgmtInterface")}
              value={info.management_interface ?? "—"}
              mono
            />
            <InfoRow
              label={t("settings.mgmtBindIp")}
              value={info.management_bind_ip ?? "—"}
              mono
            />
          </dl>
        ) : null}
        <p className="mt-4 text-sm text-ink-muted">
          {t("settings.mgmtHint")}{" "}
          <Link to="/interfaces" className="text-accent hover:underline">
            {t("nav.interfaces")}
          </Link>
        </p>
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-semibold text-ink">{t("settings.health")}</h3>
          {health ? (
            <span className={`font-mono text-sm uppercase ${statusTone(health.status)}`}>
              {health.status}
            </span>
          ) : null}
        </div>
        {healthQuery.isLoading ? <p className="mt-3 text-ink-muted">{t("common.loading")}</p> : null}
        {health ? (
          <div className="mt-4 space-y-0">
            {Object.entries(health.components).map(([name, component]) => (
              <ComponentRow key={name} name={name} component={component} />
            ))}
            <p className="mt-3 font-mono text-xs text-ink-muted">
              {t("settings.checkedAt", { time: new Date(health.checked_at).toLocaleString() })}
            </p>
          </div>
        ) : null}
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">{t("settings.orphans")}</h3>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("settings.orphansHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
              onClick={() => void orphansQuery.refetch()}
              disabled={orphansQuery.isFetching}
            >
              {t("settings.orphansRefresh")}
            </button>
            {orphans && orphanCount > 0 ? (
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper"
                onClick={() => selectAllPrunable(orphans)}
              >
                {t("settings.orphansSelectAll")}
              </button>
            ) : null}
            <button
              type="button"
              className="border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm text-danger disabled:opacity-40"
              onClick={() => void handlePrune()}
              disabled={
                pruneMutation.isPending ||
                (selectedContainers.size === 0 && selectedNetworks.size === 0)
              }
            >
              {pruneMutation.isPending ? t("settings.orphansPruning") : t("settings.orphansPrune")}
            </button>
          </div>
        </div>

        {orphansQuery.isLoading ? <p className="mt-3 text-ink-muted">{t("common.loading")}</p> : null}
        {orphansQuery.isError ? (
          <p className="mt-3 text-sm text-danger">
            {orphansQuery.error instanceof Error
              ? orphansQuery.error.message
              : t("common.unknownError")}
          </p>
        ) : null}
        {pruneMutation.isError ? (
          <p className="mt-3 text-sm text-danger">
            {pruneMutation.error instanceof Error
              ? pruneMutation.error.message
              : t("common.unknownError")}
          </p>
        ) : null}
        {pruneMutation.isSuccess && pruneMutation.data ? (
          <p className="mt-3 text-sm text-ok">
            {t("settings.orphansPruneResult", {
              containers: pruneMutation.data.removed_containers.length,
              networks: pruneMutation.data.removed_networks.length,
            })}
            {pruneMutation.data.errors.length > 0
              ? ` — ${pruneMutation.data.errors.join("; ")}`
              : null}
          </p>
        ) : null}

        {orphans ? (
          <div className="mt-4 space-y-4">
            {!orphans.docker_ok ? (
              <p className="text-sm text-warn">
                {t("settings.orphansDockerError", {
                  detail: orphans.docker_error ?? t("common.unknownError"),
                })}
              </p>
            ) : null}

            <p className="font-mono text-xs text-ink-muted">
              {t("settings.orphansSummary", {
                orphans: orphanCount,
                missing: missingCount,
                time: new Date(orphans.collected_at).toLocaleString(),
              })}
            </p>

            <OrphanGroup
              title={t("settings.orphanContainers")}
              empty={t("settings.orphansNone")}
              items={orphans.orphan_containers}
              selected={selectedContainers}
              onToggle={toggleContainer}
              renderMeta={(item) =>
                `${item.status}${item.service_type ? ` · ${item.service_type}` : ""} · ${item.reason}`
              }
            />

            <OrphanGroup
              title={t("settings.orphanNetworks")}
              empty={t("settings.orphansNone")}
              items={orphans.orphan_networks}
              selected={selectedNetworks}
              onToggle={toggleNetwork}
              renderMeta={(item) =>
                `${item.driver || "—"}${item.network_type ? ` · ${item.network_type}` : ""} · ${item.reason}`
              }
            />

            <OrphanGroup
              title={t("settings.missingContainers")}
              empty={t("settings.orphansNone")}
              items={orphans.missing_containers}
              selectable={false}
              renderMeta={(item) =>
                `${item.instance_id ?? "—"} · ${item.reason}`
              }
            />

            <OrphanGroup
              title={t("settings.missingNetworks")}
              empty={t("settings.orphansNone")}
              items={orphans.missing_networks}
              selectable={false}
              renderMeta={(item) =>
                `${item.network_id ?? "—"} · ${item.reason}`
              }
            />
          </div>
        ) : null}
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <h3 className="font-semibold text-ink">{t("settings.capabilities")}</h3>
        {capsQuery.isLoading ? <p className="mt-3 text-ink-muted">{t("common.loading")}</p> : null}
        {caps ? (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs tracking-wide text-ink-muted uppercase">
                {t("settings.features")}
              </p>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto font-mono text-xs text-ink">
                {caps.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs tracking-wide text-ink-muted uppercase">
                {t("settings.dataplane")}
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-ink">
                {caps.dataplane_services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-ink ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
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
        <span className={`font-mono text-sm uppercase ${statusTone(component.status)}`}>
          {component.status}
        </span>
        {component.latency_ms != null ? (
          <p className="mt-1 font-mono text-xs text-ink-muted">{component.latency_ms.toFixed(1)} ms</p>
        ) : null}
      </div>
    </div>
  );
}

function OrphanGroup<T extends { id: string; name: string; prunable?: boolean }>({
  title,
  empty,
  items,
  selected,
  onToggle,
  selectable = true,
  renderMeta,
}: {
  title: string;
  empty: string;
  items: T[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  selectable?: boolean;
  renderMeta: (item: T) => string;
}) {
  return (
    <div>
      <p className="text-xs tracking-wide text-ink-muted uppercase">
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border border-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-3 py-2 text-sm">
              {selectable ? (
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected?.has(item.id) ?? false}
                  disabled={!item.prunable}
                  onChange={() => onToggle?.(item.id)}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{item.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">{item.id}</p>
                <p className="mt-0.5 font-mono text-xs text-ink-muted">{renderMeta(item)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
