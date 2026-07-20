import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInstanceLogs } from "../features/instances/hooks";
import { useSystemLogs } from "../features/system/hooks";

function stateTone(state: string): string {
  if (state === "running" || state === "healthy") return "text-ok";
  if (state === "error" || state === "unhealthy") return "text-danger";
  if (state === "degraded" || state === "starting" || state === "stopping") return "text-warn";
  return "text-ink-muted";
}

export function SystemLogsPage() {
  const { t } = useTranslation();
  const logsOverview = useSystemLogs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tail, setTail] = useState(200);
  const containerLogs = useInstanceLogs(selectedId, tail);

  useEffect(() => {
    const instances = logsOverview.data?.instances ?? [];
    if (!instances.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && instances.some((item) => item.instance_id === selectedId)) {
      return;
    }
    const withError = instances.find((item) => item.has_error);
    setSelectedId((withError ?? instances[0]).instance_id);
  }, [logsOverview.data, selectedId]);

  const selected = logsOverview.data?.instances.find((item) => item.instance_id === selectedId);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("logs.title")}</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("logs.subtitle")}</p>
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <h3 className="font-semibold text-ink">{t("logs.errors")}</h3>
        {logsOverview.isLoading ? <p className="mt-3 text-ink-muted">{t("common.loading")}</p> : null}
        {logsOverview.isError ? (
          <p className="mt-3 text-sm text-danger">
            {logsOverview.error instanceof Error
              ? logsOverview.error.message
              : t("common.unknownError")}
          </p>
        ) : null}
        {logsOverview.data && logsOverview.data.errors.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">{t("logs.noErrors")}</p>
        ) : null}
        {logsOverview.data && logsOverview.data.errors.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {logsOverview.data.errors.map((item) => (
              <li key={item.instance_id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <button
                    type="button"
                    className="font-medium text-accent hover:underline"
                    onClick={() => setSelectedId(item.instance_id)}
                  >
                    {item.name}
                  </button>
                  <span className={`font-mono text-xs uppercase ${stateTone(item.actual_state)}`}>
                    {item.actual_state}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-danger">{item.last_error}</p>
                <p className="mt-1 font-mono text-[10px] text-ink-muted">
                  {new Date(item.updated_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h3 className="font-semibold text-ink">{t("logs.containerLogs")}</h3>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-ink-muted">{t("logs.tail")}</span>
            <select
              value={tail}
              onChange={(e) => setTail(Number(e.target.value))}
              className="border border-line bg-paper px-2 py-1 font-mono text-xs"
            >
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </label>
        </div>

        {(logsOverview.data?.instances.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            {t("logs.noInstances")}{" "}
            <Link to="/catalog" className="text-accent hover:underline">
              {t("catalog.title")}
            </Link>
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <ul className="space-y-1">
              {(logsOverview.data?.instances ?? []).map((item) => (
                <li key={item.instance_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.instance_id)}
                    className={`w-full border px-3 py-2 text-left text-sm ${
                      selectedId === item.instance_id
                        ? "border-accent bg-accent-soft/40"
                        : "border-line hover:border-accent"
                    }`}
                  >
                    <span className="font-medium text-ink">{item.name}</span>
                    <span
                      className={`mt-1 block font-mono text-[10px] uppercase ${stateTone(item.actual_state)}`}
                    >
                      {item.actual_state}
                      {item.has_error ? ` · ${t("logs.hasError")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div>
              {selected ? (
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs text-ink-muted">
                    {selected.container_name ?? selected.instance_id}
                  </p>
                  {selected.service_type === "haproxy" ? (
                    <Link
                      to={`/instances/${selected.instance_id}/haproxy`}
                      className="text-xs text-accent hover:underline"
                    >
                      HAProxy
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <pre className="max-h-[28rem] overflow-auto bg-ink px-3 py-3 font-mono text-xs text-paper">
                {containerLogs.isLoading
                  ? t("common.loading")
                  : containerLogs.data?.logs || t("logs.emptyTail")}
              </pre>
              {containerLogs.isError ? (
                <p className="mt-2 text-sm text-danger">
                  {containerLogs.error instanceof Error
                    ? containerLogs.error.message
                    : t("common.unknownError")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
