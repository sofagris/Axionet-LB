import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MutationGate } from "../components/MutationGate";
import { useAuthGatewayOverview } from "../features/authGateway/hooks";
import {
  useInstanceAction,
  useInstanceLogs,
  useInstanceNetworkMutations,
  useInstances,
} from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";

type Tab = "overview" | "networks" | "logs";

export function AuthGatewayDetailPage() {
  const { t } = useTranslation();
  const { instanceId = "" } = useParams();
  const instancesQuery = useInstances();
  const instance = useMemo(
    () => instancesQuery.data?.find((item) => item.id === instanceId),
    [instancesQuery.data, instanceId],
  );

  const [tab, setTab] = useState<Tab>("overview");
  const [logTail, setLogTail] = useState(200);
  const overviewQuery = useAuthGatewayOverview(instanceId);
  const logsQuery = useInstanceLogs(tab === "logs" ? instanceId : null, logTail);
  const actionMutation = useInstanceAction();
  const networksQuery = useNetworks();
  const networkMutations = useInstanceNetworkMutations();
  const [attachNetworkId, setAttachNetworkId] = useState("");
  const [attachIp, setAttachIp] = useState("");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: t("authGateway.tabs.overview") },
    { id: "networks", label: t("authGateway.tabs.networks") },
    { id: "logs", label: t("authGateway.tabs.logs") },
  ];

  if (!instanceId) {
    return <p className="text-danger">Missing instance id</p>;
  }

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-accent uppercase">
            <Link to="/instances" className="hover:underline">
              {t("nav.instances")}
            </Link>
            {" / "}
            {t("authGateway.label")}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {instance?.name ?? instanceId}
          </h2>
          <p className="mt-1 font-mono text-sm text-ink-muted">
            {instance?.actual_state ?? "…"} · {instance?.image}
          </p>
        </div>
        <MutationGate hide>
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
          </div>
        </MutationGate>
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
          <div className="space-y-3 border border-line bg-paper-elevated p-4">
            <h3 className="font-medium text-ink">{t("authGateway.endpointsTitle")}</h3>
            {overviewQuery.isLoading ? (
              <p className="text-sm text-ink-muted">{t("common.loading")}</p>
            ) : (
              <dl className="space-y-2 font-mono text-sm">
                <div>
                  <dt className="text-ink-muted">{t("authGateway.listenUrl")}</dt>
                  <dd className="break-all">{overview?.listen_url ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("authGateway.upstream")}</dt>
                  <dd className="break-all">{overview?.upstream_url ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("authGateway.issuer")}</dt>
                  <dd className="break-all">{overview?.oidc_issuer_url ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("authGateway.redirect")}</dt>
                  <dd className="break-all">{overview?.redirect_url ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("authGateway.clientId")}</dt>
                  <dd>{overview?.client_id ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("keycloak.attachmentIps")}</dt>
                  <dd>{overview?.attachment_ips?.join(", ") || "—"}</dd>
                </div>
              </dl>
            )}
          </div>
          <div className="space-y-3 border border-line bg-paper-elevated p-4">
            <h3 className="font-medium text-ink">{t("authGateway.patternTitle")}</h3>
            <p className="text-sm text-ink-muted">{t("authGateway.patternHint")}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>{t("authGateway.patternStep1")}</li>
              <li>{t("authGateway.patternStep2")}</li>
              <li>{t("authGateway.patternStep3")}</li>
            </ol>
            <p className="text-sm text-ink-muted">{t("authGateway.headersHint")}</p>
          </div>
        </div>
      ) : null}

      {tab === "networks" ? (
        <div className="space-y-4 border border-line bg-paper-elevated p-4">
          <div>
            <h3 className="font-medium text-ink">{t("frr.attachmentsTitle")}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t("authGateway.networksHint")}</p>
          </div>
          <MutationGate>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                if (!attachNetworkId) return;
                void networkMutations.attach.mutateAsync({
                  id: instanceId,
                  payload: {
                    network_id: attachNetworkId,
                    ip_address: attachIp.trim() || null,
                  },
                });
                setAttachNetworkId("");
                setAttachIp("");
              }}
            >
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.attachNetwork")}</span>
                <select
                  value={attachNetworkId}
                  onChange={(e) => setAttachNetworkId(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                >
                  <option value="">{t("frr.attachNetworkPlaceholder")}</option>
                  {(networksQuery.data ?? []).map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name} ({network.network_type})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.attachIp")}</span>
                <input
                  value={attachIp}
                  onChange={(e) => setAttachIp(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  placeholder={t("frr.attachIpPlaceholder")}
                />
              </label>
              <button type="submit" className="self-end border border-line px-3 py-2 text-sm">
                {t("frr.attach")}
              </button>
            </form>
          </MutationGate>
          <ul className="space-y-2 font-mono text-sm">
            {(instance?.networks ?? []).map((attachment) => {
              const network = (networksQuery.data ?? []).find((item) => item.id === attachment.network_id);
              return (
                <li
                  key={attachment.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2"
                >
                  <span>
                    {network?.name ?? attachment.network_id}
                    {attachment.ip_address ? ` @ ${attachment.ip_address}` : ""}
                  </span>
                  <MutationGate>
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={() => {
                        void networkMutations.detach.mutateAsync({
                          id: instanceId,
                          attachmentId: attachment.id,
                        });
                      }}
                    >
                      {t("frr.detach")}
                    </button>
                  </MutationGate>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {tab === "logs" ? (
        <div className="space-y-3 border border-line bg-paper-elevated p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-ink-muted">
              {t("instances.logTail")}
              <input
                type="number"
                min={50}
                max={2000}
                value={logTail}
                onChange={(e) => setLogTail(Number(e.target.value) || 200)}
                className="ml-2 w-24 border border-line bg-paper px-2 py-1 font-mono text-sm"
              />
            </label>
          </div>
          <pre className="max-h-[28rem] overflow-auto bg-ink px-3 py-2 font-mono text-xs text-paper">
            {logsQuery.data?.logs ?? t("common.loading")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
