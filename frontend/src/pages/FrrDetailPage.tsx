import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DiffView } from "../features/revisions/DiffView";
import { useFrrBgp, useFrrConfig, useUpdateFrrConfig } from "../features/frr/hooks";
import {
  useInstanceAction,
  useInstanceLogs,
  useInstances,
  useValidateExistingInstance,
} from "../features/instances/hooks";
import { useRestoreRevision, useRevision, useRevisions } from "../features/revisions/hooks";
import type { InstanceValidateResult } from "../types/instances";

type Tab = "overview" | "bgp" | "logs" | "revisions";

type NeighborDraft = {
  name: string;
  address: string;
  remote_as: string;
  password: string;
  description: string;
};

export function FrrDetailPage() {
  const { t } = useTranslation();
  const { instanceId = "" } = useParams();
  const instancesQuery = useInstances();
  const instance = useMemo(
    () => instancesQuery.data?.find((item) => item.id === instanceId),
    [instancesQuery.data, instanceId],
  );

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [revisionView, setRevisionView] = useState<"diff" | "full">("diff");
  const [logTail, setLogTail] = useState(200);
  const [validation, setValidation] = useState<InstanceValidateResult | null>(null);

  const configQuery = useFrrConfig(instanceId);
  const bgpQuery = useFrrBgp(instanceId, tab === "bgp");
  const updateConfig = useUpdateFrrConfig(instanceId);
  const revisionsQuery = useRevisions(instanceId);
  const revisionDetailQuery = useRevision(instanceId, selectedRevisionId);
  const restoreRevision = useRestoreRevision(instanceId);
  const logsQuery = useInstanceLogs(tab === "logs" ? instanceId : null, logTail);
  const actionMutation = useInstanceAction();
  const validateMutation = useValidateExistingInstance();

  const [hostname, setHostname] = useState("");
  const [routerId, setRouterId] = useState("");
  const [localAs, setLocalAs] = useState("65001");
  const [networksText, setNetworksText] = useState("");
  const [neighbors, setNeighbors] = useState<NeighborDraft[]>([
    { name: "peer1", address: "", remote_as: "65000", password: "", description: "" },
  ]);

  useEffect(() => {
    if (!configQuery.data) return;
    const cfg = configQuery.data.configuration as Record<string, unknown>;
    const neighborsRaw = Array.isArray(cfg.neighbors) ? cfg.neighbors : [];
    setHostname(String(cfg.hostname ?? "ax-frr"));
    setRouterId(String(cfg.router_id ?? "1.1.1.1"));
    setLocalAs(String(cfg.local_as ?? 65001));
    setNetworksText(Array.isArray(cfg.networks) ? (cfg.networks as string[]).join("\n") : "");
    setNeighbors(
      neighborsRaw.length
        ? neighborsRaw.map((item) => {
            const row = item as Record<string, unknown>;
            return {
              name: String(row.name ?? "peer1"),
              address: String(row.address ?? ""),
              remote_as: String(row.remote_as ?? 65000),
              password: String(row.password ?? ""),
              description: String(row.description ?? ""),
            };
          })
        : [{ name: "peer1", address: "", remote_as: "65000", password: "", description: "" }],
    );
  }, [configQuery.data]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: t("frr.tabs.overview") },
    { id: "bgp", label: t("frr.tabs.bgp") },
    { id: "logs", label: t("frr.tabs.logs") },
    { id: "revisions", label: t("frr.tabs.revisions") },
  ];

  async function onSave(event: FormEvent) {
    event.preventDefault();
    await updateConfig.mutateAsync({
      hostname,
      router_id: routerId,
      local_as: Number(localAs),
      networks: networksText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      neighbors: neighbors
        .filter((item) => item.address.trim())
        .map((item) => ({
          name: item.name.trim() || "peer1",
          address: item.address.trim(),
          remote_as: Number(item.remote_as),
          password: item.password.trim() || null,
          description: item.description.trim() || null,
        })),
    });
  }

  if (!instanceId) {
    return <p className="text-danger">Missing instance id</p>;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-accent uppercase">
            <Link to="/instances" className="hover:underline">
              {t("nav.instances")}
            </Link>
            {" / "}
            FRR
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {instance?.name ?? instanceId}
          </h2>
          <p className="mt-1 font-mono text-sm text-ink-muted">
            {instance?.actual_state ?? "…"} · {instance?.image}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm"
            onClick={() => actionMutation.mutate({ id: instanceId, action: "start" })}
          >
            {t("instances.start")}
          </button>
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm"
            onClick={() => actionMutation.mutate({ id: instanceId, action: "stop" })}
          >
            {t("instances.stop")}
          </button>
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm"
            onClick={() => actionMutation.mutate({ id: instanceId, action: "restart" })}
          >
            {t("instances.restart")}
          </button>
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm"
            onClick={() => actionMutation.mutate({ id: instanceId, action: "reload" })}
          >
            {t("instances.reload")}
          </button>
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm"
            onClick={() => {
              void validateMutation.mutateAsync(instanceId).then(setValidation);
            }}
          >
            {t("wizard.validate")}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-line pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 text-sm ${
              tab === item.id ? "bg-accent text-white" : "border border-line text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-4 border border-line bg-paper-elevated p-4" onSubmit={(e) => void onSave(e)}>
            <h3 className="font-medium text-ink">{t("frr.configTitle")}</h3>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("frr.hostname")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("frr.routerId")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={routerId}
                onChange={(e) => setRouterId(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("frr.localAs")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={localAs}
                onChange={(e) => setLocalAs(e.target.value)}
              />
            </label>
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">{t("frr.neighbors")}</p>
              {neighbors.map((neighbor, index) => (
                <div key={index} className="grid gap-2 border border-line p-3 md:grid-cols-2">
                  <input
                    placeholder={t("frr.neighborAddress")}
                    className="border border-line bg-paper px-2 py-1.5 font-mono text-sm"
                    value={neighbor.address}
                    onChange={(e) => {
                      const next = [...neighbors];
                      next[index] = { ...next[index], address: e.target.value };
                      setNeighbors(next);
                    }}
                  />
                  <input
                    placeholder={t("frr.remoteAs")}
                    className="border border-line bg-paper px-2 py-1.5 font-mono text-sm"
                    value={neighbor.remote_as}
                    onChange={(e) => {
                      const next = [...neighbors];
                      next[index] = { ...next[index], remote_as: e.target.value };
                      setNeighbors(next);
                    }}
                  />
                  <input
                    placeholder={t("frr.password")}
                    className="border border-line bg-paper px-2 py-1.5 font-mono text-sm"
                    value={neighbor.password}
                    onChange={(e) => {
                      const next = [...neighbors];
                      next[index] = { ...next[index], password: e.target.value };
                      setNeighbors(next);
                    }}
                  />
                  <input
                    placeholder={t("frr.description")}
                    className="border border-line bg-paper px-2 py-1.5 font-mono text-sm"
                    value={neighbor.description}
                    onChange={(e) => {
                      const next = [...neighbors];
                      next[index] = { ...next[index], description: e.target.value };
                      setNeighbors(next);
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-accent hover:underline"
                onClick={() =>
                  setNeighbors([
                    ...neighbors,
                    { name: `peer${neighbors.length + 1}`, address: "", remote_as: "65000", password: "", description: "" },
                  ])
                }
              >
                {t("frr.addNeighbor")}
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("frr.networks")}</span>
              <textarea
                className="mt-1 h-28 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={networksText}
                onChange={(e) => setNetworksText(e.target.value)}
                placeholder={"203.0.113.0/24"}
              />
            </label>
            <button
              type="submit"
              disabled={updateConfig.isPending}
              className="border border-accent bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {updateConfig.isPending ? t("common.saving") : t("frr.saveConfig")}
            </button>
            {updateConfig.isError ? (
              <p className="text-sm text-danger">{(updateConfig.error as Error).message}</p>
            ) : null}
            {validation ? (
              <p className={`text-sm ${validation.ok ? "text-ok" : "text-danger"}`}>
                {validation.output}
              </p>
            ) : null}
          </form>
          <div className="border border-line bg-paper-elevated p-4">
            <h3 className="font-medium text-ink">{t("frr.rendered")}</h3>
            <pre className="mt-3 max-h-[32rem] overflow-auto font-mono text-xs text-ink">
              {configQuery.data?.rendered ?? "…"}
            </pre>
          </div>
        </div>
      ) : null}

      {tab === "bgp" ? (
        <div className="space-y-4">
          {bgpQuery.isError ? (
            <p className="text-sm text-danger">{(bgpQuery.error as Error).message}</p>
          ) : null}
          <div className="border border-line bg-paper-elevated p-4">
            <h3 className="font-medium text-ink">{t("frr.bgpSummary")}</h3>
            <pre className="mt-3 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {bgpQuery.data?.summary ?? (bgpQuery.isLoading ? "…" : t("frr.noBgpData"))}
            </pre>
          </div>
          <div className="border border-line bg-paper-elevated p-4">
            <h3 className="font-medium text-ink">{t("frr.bgpNeighbors")}</h3>
            <pre className="mt-3 overflow-auto font-mono text-xs whitespace-pre-wrap">
              {bgpQuery.data?.neighbors ?? (bgpQuery.isLoading ? "…" : t("frr.noBgpData"))}
            </pre>
          </div>
        </div>
      ) : null}

      {tab === "logs" ? (
        <div className="border border-line bg-paper-elevated p-4">
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-ink-muted">
              Tail{" "}
              <input
                type="number"
                className="ml-2 w-24 border border-line bg-paper px-2 py-1 font-mono text-sm"
                value={logTail}
                onChange={(e) => setLogTail(Number(e.target.value) || 200)}
              />
            </label>
          </div>
          <pre className="max-h-[36rem] overflow-auto font-mono text-xs whitespace-pre-wrap">
            {logsQuery.data?.logs ?? (logsQuery.isLoading ? "…" : "")}
          </pre>
        </div>
      ) : null}

      {tab === "revisions" ? (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <ul className="space-y-1 border border-line bg-paper-elevated p-2">
            {(revisionsQuery.data ?? []).map((revision) => (
              <li key={revision.id}>
                <button
                  type="button"
                  className={`w-full px-2 py-1.5 text-left font-mono text-sm ${
                    selectedRevisionId === revision.id ? "bg-accent-soft" : "hover:bg-paper"
                  }`}
                  onClick={() => setSelectedRevisionId(revision.id)}
                >
                  r{revision.revision_number} · {revision.deployment_status}
                </button>
              </li>
            ))}
          </ul>
          <div className="border border-line bg-paper-elevated p-4">
            {revisionDetailQuery.data ? (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="border border-line px-2 py-1 text-sm"
                    onClick={() => setRevisionView("diff")}
                  >
                    Diff
                  </button>
                  <button
                    type="button"
                    className="border border-line px-2 py-1 text-sm"
                    onClick={() => setRevisionView("full")}
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    className="border border-accent px-2 py-1 text-sm text-accent"
                    onClick={() => restoreRevision.mutate(revisionDetailQuery.data.id)}
                  >
                    {t("revisions.restore")}
                  </button>
                </div>
                {revisionView === "diff" ? (
                  <DiffView text={revisionDetailQuery.data.diff_from_previous ?? ""} />
                ) : (
                  <pre className="overflow-auto font-mono text-xs whitespace-pre-wrap">
                    {revisionDetailQuery.data.rendered_configuration}
                  </pre>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t("revisions.pick")}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
