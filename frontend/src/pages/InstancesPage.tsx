import { Link } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type InstanceAction,
  useInstanceAction,
  useInstanceLogs,
  useInstances,
  useValidateExistingInstance,
} from "../features/instances/hooks";
import type { Instance, InstanceValidateResult } from "../types/instances";

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
  const { t } = useTranslation();
  const instancesQuery = useInstances();
  const actionMutation = useInstanceAction();
  const validateMutation = useValidateExistingInstance();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validation, setValidation] = useState<InstanceValidateResult | null>(null);
  const logsQuery = useInstanceLogs(selectedId);

  async function onValidate(id: string) {
    setSelectedId(id);
    const result = await validateMutation.mutateAsync(id);
    setValidation(result);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{t("instances.title")}</h2>
          <p className="mt-1 max-w-2xl text-ink-muted">{t("instances.subtitle")}</p>
        </div>
        <Link
          to="/catalog"
          className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {t("instances.newFromCatalog")}
        </Link>
      </section>

      {instancesQuery.data ? (
        <div className="overflow-x-auto border border-line bg-paper-elevated p-4 shadow-sm">
          {instancesQuery.data.length === 0 ? (
            <p className="text-ink-muted">
              {t("instances.empty")}{" "}
              <Link to="/catalog" className="text-accent hover:underline">
                {t("catalog.title")}
              </Link>
            </p>
          ) : (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">{t("instances.colName")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("instances.colIp")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("instances.colDesired")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("instances.colActual")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("instances.colHealth")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("instances.colContainer")}</th>
                  <th className="pb-2 font-medium">{t("instances.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {instancesQuery.data.map((instance) => (
                  <InstanceRow
                    key={instance.id}
                    instance={instance}
                    selected={selectedId === instance.id}
                    busy={actionMutation.isPending || validateMutation.isPending}
                    onSelect={() => {
                      setSelectedId(instance.id);
                      setValidation(null);
                    }}
                    onAction={(action) => actionMutation.mutate({ id: instance.id, action })}
                    onValidate={() => void onValidate(instance.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
          {actionMutation.isError ? (
            <p className="mt-3 text-sm text-danger">
              {actionMutation.error instanceof Error
                ? actionMutation.error.message
                : t("common.unknownError")}
            </p>
          ) : null}
          {validateMutation.isError ? (
            <p className="mt-3 text-sm text-danger">
              {validateMutation.error instanceof Error
                ? validateMutation.error.message
                : t("common.unknownError")}
            </p>
          ) : null}
        </div>
      ) : null}

      {validation ? (
        <section className="border border-line bg-paper-elevated p-4 shadow-sm">
          <h3 className="font-semibold text-ink">{t("instances.validateResult")}</h3>
          <p className={`mt-2 font-mono text-sm ${validation.ok ? "text-ok" : "text-danger"}`}>
            {validation.ok ? t("wizard.validOk") : t("wizard.validFail")}
          </p>
          <pre className="mt-3 max-h-40 overflow-auto bg-ink px-3 py-3 font-mono text-xs text-paper">
            {validation.output}
          </pre>
        </section>
      ) : null}

      {selectedId ? (
        <section className="border border-line bg-paper-elevated p-4 shadow-sm">
          <h3 className="font-semibold text-ink">{t("instances.logs")}</h3>
          <p className="mt-1 font-mono text-xs text-ink-muted">{selectedId}</p>
          <pre className="mt-3 max-h-80 overflow-auto bg-ink px-3 py-3 font-mono text-xs text-paper">
            {logsQuery.isLoading
              ? t("common.loading")
              : logsQuery.data?.logs || t("instances.noLogs")}
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
  onValidate,
}: {
  instance: Instance;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onAction: (action: InstanceAction) => void;
  onValidate: () => void;
}) {
  const { t } = useTranslation();
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
            {t("instances.start")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={() => onAction("stop")}
          >
            {t("instances.stop")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={() => onAction("restart")}
          >
            {t("instances.restart")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={() => onAction("reload")}
          >
            {t("instances.reload")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={() => onAction("reconcile")}
          >
            {t("instances.reconcile")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-ink-muted hover:underline"
            onClick={onValidate}
          >
            {t("instances.validate")}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs text-danger hover:underline"
            onClick={() => onAction("delete")}
          >
            {t("instances.delete")}
          </button>
        </div>
      </td>
    </tr>
  );
}
