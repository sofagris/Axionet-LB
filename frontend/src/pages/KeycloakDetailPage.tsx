import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MutationGate } from "../components/MutationGate";
import {
  useInstanceAction,
  useInstanceLogs,
  useInstanceNetworkMutations,
  useInstances,
} from "../features/instances/hooks";
import { useKeycloakOverview, useWireKeycloakAppIdp, useWireKeycloakPlatformOidc } from "../features/keycloak/hooks";
import { useNetworks } from "../features/networks/hooks";

type Tab = "overview" | "networks" | "logs";

export function KeycloakDetailPage() {
  const { t } = useTranslation();
  const { instanceId = "" } = useParams();
  const instancesQuery = useInstances();
  const instance = useMemo(
    () => instancesQuery.data?.find((item) => item.id === instanceId),
    [instancesQuery.data, instanceId],
  );

  const [tab, setTab] = useState<Tab>("overview");
  const [logTail, setLogTail] = useState(200);
  const [upnSuffix, setUpnSuffix] = useState("lab.local");
  const [sourceName, setSourceName] = useState("Keycloak Management");
  const [wireResult, setWireResult] = useState<string | null>(null);
  const [idpName, setIdpName] = useState("Keycloak Apps");
  const [customerId, setCustomerId] = useState("kunde-a");
  const [applicationId, setApplicationId] = useState("app-web");
  const [appWireResult, setAppWireResult] = useState<string | null>(null);

  const overviewQuery = useKeycloakOverview(instanceId);
  const wireMutation = useWireKeycloakPlatformOidc(instanceId);
  const appWireMutation = useWireKeycloakAppIdp(instanceId);
  const logsQuery = useInstanceLogs(tab === "logs" ? instanceId : null, logTail);
  const actionMutation = useInstanceAction();
  const networksQuery = useNetworks();
  const networkMutations = useInstanceNetworkMutations();
  const [attachNetworkId, setAttachNetworkId] = useState("");
  const [attachIp, setAttachIp] = useState("");

  const isMgmt = instance?.service_type === "keycloak-mgmt";
  const isApps = instance?.service_type === "keycloak-apps";
  const attachableNetworks = useMemo(() => {
    const all = networksQuery.data ?? [];
    if (isMgmt) {
      return all.filter((item) => item.network_type === "management");
    }
    return all;
  }, [networksQuery.data, isMgmt]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: t("keycloak.tabs.overview") },
    { id: "networks", label: t("keycloak.tabs.networks") },
    { id: "logs", label: t("keycloak.tabs.logs") },
  ];

  async function onWire(event: FormEvent) {
    event.preventDefault();
    setWireResult(null);
    const result = await wireMutation.mutateAsync({
      source_name: sourceName.trim() || "Keycloak Management",
      upn_suffix: upnSuffix.trim() || "lab.local",
    });
    setWireResult(
      t("keycloak.wireOk", {
        name: result.auth_source_name,
        issuer: result.issuer_url,
        suffix: result.upn_suffix,
      }),
    );
  }

  async function onWireAppIdp(event: FormEvent) {
    event.preventDefault();
    setAppWireResult(null);
    const result = await appWireMutation.mutateAsync({
      idp_name: idpName.trim() || "Keycloak Apps",
      customer_id: customerId.trim() || null,
      application_id: applicationId.trim() || null,
    });
    setAppWireResult(
      t("keycloak.wireAppOk", {
        name: result.app_identity_provider_name,
        issuer: result.issuer_url,
      }),
    );
  }

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
            {isMgmt ? t("keycloak.mgmtLabel") : t("keycloak.appsLabel")}
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
            <h3 className="font-medium text-ink">{t("keycloak.endpointsTitle")}</h3>
            {overviewQuery.isLoading ? (
              <p className="text-sm text-ink-muted">{t("common.loading")}</p>
            ) : (
              <dl className="space-y-2 font-mono text-sm">
                <div>
                  <dt className="text-ink-muted">{t("keycloak.realm")}</dt>
                  <dd>{overview?.realm ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("keycloak.issuer")}</dt>
                  <dd className="break-all">{overview?.issuer_url ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("keycloak.adminConsole")}</dt>
                  <dd>
                    {overview?.admin_console_url ? (
                      <a
                        href={overview.admin_console_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {overview.admin_console_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("keycloak.attachmentIps")}</dt>
                  <dd>{overview?.attachment_ips?.join(", ") || "—"}</dd>
                </div>
              </dl>
            )}
            <p className="text-sm text-ink-muted">{t("keycloak.exposureHint")}</p>
          </div>

          {isMgmt ? (
            <div className="space-y-3 border border-line bg-paper-elevated p-4">
              <h3 className="font-medium text-ink">{t("keycloak.wireTitle")}</h3>
              <p className="text-sm text-ink-muted">{t("keycloak.wireHint")}</p>
              <MutationGate>
                <form className="space-y-3" onSubmit={(event) => void onWire(event)}>
                  <label className="block text-sm">
                    <span className="text-ink-muted">{t("keycloak.sourceName")}</span>
                    <input
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-ink-muted">{t("keycloak.upnSuffix")}</span>
                    <input
                      value={upnSuffix}
                      onChange={(e) => setUpnSuffix(e.target.value)}
                      className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={wireMutation.isPending}
                    className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {wireMutation.isPending ? t("common.saving") : t("keycloak.wireAction")}
                  </button>
                </form>
              </MutationGate>
              {wireMutation.isError ? (
                <p className="text-sm text-danger">
                  {wireMutation.error instanceof Error
                    ? wireMutation.error.message
                    : t("common.unknownError")}
                </p>
              ) : null}
              {wireResult ? <p className="text-sm text-ok">{wireResult}</p> : null}
            </div>
          ) : isApps ? (
            <div className="space-y-3 border border-line bg-paper-elevated p-4">
              <h3 className="font-medium text-ink">{t("keycloak.wireAppTitle")}</h3>
              <p className="text-sm text-ink-muted">{t("keycloak.wireAppHint")}</p>
              <MutationGate>
                <form className="space-y-3" onSubmit={(event) => void onWireAppIdp(event)}>
                  <label className="block text-sm">
                    <span className="text-ink-muted">{t("keycloak.idpName")}</span>
                    <input
                      value={idpName}
                      onChange={(e) => setIdpName(e.target.value)}
                      className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-ink-muted">{t("keycloak.customerId")}</span>
                    <input
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                      placeholder="kunde-a"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-ink-muted">{t("keycloak.applicationId")}</span>
                    <input
                      value={applicationId}
                      onChange={(e) => setApplicationId(e.target.value)}
                      className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                      placeholder="app-web"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={appWireMutation.isPending}
                    className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {appWireMutation.isPending ? t("common.saving") : t("keycloak.wireAppAction")}
                  </button>
                </form>
              </MutationGate>
              {appWireMutation.isError ? (
                <p className="text-sm text-danger">
                  {appWireMutation.error instanceof Error
                    ? appWireMutation.error.message
                    : t("common.unknownError")}
                </p>
              ) : null}
              {appWireResult ? <p className="text-sm text-ok">{appWireResult}</p> : null}
            </div>
          ) : (
            <div className="space-y-3 border border-line bg-paper-elevated p-4">
              <h3 className="font-medium text-ink">{t("keycloak.appsMetaTitle")}</h3>
              <p className="text-sm text-ink-muted">{t("keycloak.appsMetaHint")}</p>
              <p className="font-mono text-sm break-all">{overview?.issuer_url ?? "—"}</p>
            </div>
          )}
        </div>
      ) : null}

      {tab === "networks" ? (
        <div className="space-y-4 border border-line bg-paper-elevated p-4">
          <div>
            <h3 className="font-medium text-ink">{t("frr.attachmentsTitle")}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {isMgmt ? t("keycloak.mgmtNetworksHint") : t("frr.attachmentsHint")}
            </p>
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
                  {attachableNetworks.map((network) => (
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
                        if (!window.confirm(t("frr.detachConfirm", { name: network?.name ?? "" }))) {
                          return;
                        }
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
        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-ink-muted">{t("instances.tail")}</span>
            <input
              type="number"
              min={50}
              max={2000}
              value={logTail}
              onChange={(e) => setLogTail(Number(e.target.value))}
              className="w-24 border border-line bg-paper px-2 py-1 font-mono text-sm"
            />
          </label>
          <pre className="max-h-[28rem] overflow-auto bg-ink px-3 py-3 font-mono text-xs text-paper">
            {logsQuery.data?.logs ?? t("common.loading")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
