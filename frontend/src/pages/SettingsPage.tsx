import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useCapabilities,
  useSystemHealth,
  useSystemInfo,
} from "../features/system/hooks";
import type { ComponentHealth } from "../types/system";

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

  const info = infoQuery.data;
  const health = healthQuery.data;
  const caps = capsQuery.data;

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
