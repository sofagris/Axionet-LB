import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../features/auth/usePermissions";
import { useServiceDefinitions } from "../features/catalog/hooks";
import { useCreateInstance, useValidateInstanceConfig } from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";
import type { InstanceValidateResult } from "../types/instances";
import { instanceDetailPath } from "../lib/instancePaths";

const STEPS = 7;

type AttachmentDraft = {
  network_id: string;
  ip_address: string;
};

function buildHaproxyConfig(input: {
  mode: "http" | "tcp";
  bindPort: number;
  serverAddress: string;
  serverPort: number;
}) {
  return {
    mode: input.mode,
    stats_port: 8404,
    frontends: [
      {
        name: "main",
        bind_address: "*",
        bind_port: input.bindPort,
        mode: input.mode,
        default_backend: "app",
        certificate: null,
      },
    ],
    backends: [
      {
        name: "app",
        balance: "roundrobin",
        mode: input.mode,
        httpchk: input.mode === "http",
        httpchk_method: "GET",
        httpchk_uri: "/",
        httpchk_expect_status: input.mode === "http" ? 200 : null,
        servers: [
          {
            name: "s1",
            address: input.serverAddress || "127.0.0.1",
            port: input.serverPort,
            check: true,
            weight: 100,
            inter_ms: 2000,
            rise: 2,
            fall: 3,
          },
        ],
      },
    ],
    certificates: [],
    maps: [],
    acls: [],
    timeout_connect: "5s",
    timeout_client: "30s",
    timeout_server: "30s",
  };
}

function isKeycloakService(serviceType: string): boolean {
  return serviceType === "keycloak-mgmt" || serviceType === "keycloak-apps";
}

function isAuthGatewayService(serviceType: string): boolean {
  return serviceType === "auth-gateway";
}

function buildAuthGatewayConfig(input: {
  upstreamUrl: string;
  oidcIssuerUrl: string;
  clientId: string;
  clientSecret: string;
}) {
  return {
    upstream_url: input.upstreamUrl.trim() || "http://127.0.0.1:8080",
    oidc_issuer_url: input.oidcIssuerUrl.trim(),
    client_id: input.clientId.trim() || "axionet-app",
    client_secret: input.clientSecret.trim() || "axionet-app-lab-secret",
    email_domains: "*",
    http_port: 4180,
    cookie_secure: false,
    pass_user_headers: true,
    set_xauthrequest: true,
  };
}

function buildKeycloakConfig(input: {
  realm: string;
  adminUsername: string;
  adminPassword: string;
  publicBaseUrl: string;
  guiClientSecret: string;
}) {
  return {
    realm: input.realm || "axionet",
    http_port: 8080,
    admin_username: input.adminUsername || "admin",
    admin_password: input.adminPassword || "admin",
    gui_client_id: "axionet-gui",
    gui_client_secret: input.guiClientSecret || "axionet-gui-lab-secret",
    app_client_id: "axionet-app",
    app_client_secret: "axionet-app-lab-secret",
    import_realm: true,
    start_mode: "dev",
    public_base_url: input.publicBaseUrl.trim() || null,
    hostname_strict: false,
  };
}

function buildFrrConfig(input: {
  hostname: string;
  routerId: string;
  localAs: number;
  neighborAddress: string;
  remoteAs: number;
  password: string;
  networks: string;
}) {
  const networks = input.networks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    hostname: input.hostname || "ax-frr",
    router_id: input.routerId || "1.1.1.1",
    local_as: input.localAs,
    neighbors: input.neighborAddress
      ? [
          {
            name: "peer1",
            address: input.neighborAddress,
            remote_as: input.remoteAs,
            password: input.password || null,
            description: null,
          },
        ]
      : [],
    networks,
    log_stdout: true,
  };
}

export function CreateInstanceWizardPage() {
  const { t } = useTranslation();
  const { canMutate } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const catalogQuery = useServiceDefinitions();
  const networksQuery = useNetworks();
  const createMutation = useCreateInstance();
  const validateMutation = useValidateInstanceConfig();

  const enabledServices = useMemo(
    () => (catalogQuery.data ?? []).filter((item) => item.enabled),
    [catalogQuery.data],
  );

  const initialType = searchParams.get("type") || "haproxy";
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState(initialType);
  const [name, setName] = useState("");
  const [imageVersion, setImageVersion] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([
    { network_id: "", ip_address: "" },
  ]);
  const [mode, setMode] = useState<"http" | "tcp">("http");
  const [bindPort, setBindPort] = useState(80);
  const [serverAddress, setServerAddress] = useState("127.0.0.1");
  const [serverPort, setServerPort] = useState(8080);
  const [frrHostname, setFrrHostname] = useState("ax-frr");
  const [frrRouterId, setFrrRouterId] = useState("");
  const [frrLocalAs, setFrrLocalAs] = useState(65001);
  const [frrNeighbor, setFrrNeighbor] = useState("");
  const [frrRemoteAs, setFrrRemoteAs] = useState(65000);
  const [frrPassword, setFrrPassword] = useState("");
  const [frrNetworks, setFrrNetworks] = useState("203.0.113.0/24");
  const [kcRealm, setKcRealm] = useState("axionet");
  const [kcAdminUser, setKcAdminUser] = useState("admin");
  const [kcAdminPass, setKcAdminPass] = useState("admin");
  const [kcPublicBaseUrl, setKcPublicBaseUrl] = useState("http://192.168.50.195");
  const [kcGuiSecret, setKcGuiSecret] = useState("axionet-gui-lab-secret");
  const [gwUpstream, setGwUpstream] = useState("http://192.168.50.195:9080");
  const [gwIssuer, setGwIssuer] = useState("http://192.168.50.60:8080/realms/axionet");
  const [gwClientId, setGwClientId] = useState("axionet-app");
  const [gwClientSecret, setGwClientSecret] = useState("axionet-app-lab-secret");
  const [validation, setValidation] = useState<InstanceValidateResult | null>(null);
  const [desiredRunning, setDesiredRunning] = useState(false);

  const selectedDef = (catalogQuery.data ?? []).find((item) => item.service_type === serviceType);
  const version = imageVersion || selectedDef?.default_version || "3.2.6";
  const networks = useMemo(() => {
    const all = networksQuery.data ?? [];
    if (serviceType === "keycloak-mgmt") {
      return all.filter((item) => item.network_type === "management");
    }
    return all;
  }, [networksQuery.data, serviceType]);

  const configuration = useMemo(() => {
    if (serviceType === "frr") {
      const attachmentIp =
        attachments.map((item) => item.ip_address.trim()).find(Boolean) || "";
      const routerId =
        frrRouterId.trim() ||
        (attachmentIp.includes("/") ? attachmentIp.split("/")[0] : attachmentIp) ||
        "1.1.1.1";
      return buildFrrConfig({
        hostname: frrHostname || name || "ax-frr",
        routerId,
        localAs: frrLocalAs,
        neighborAddress: frrNeighbor,
        remoteAs: frrRemoteAs,
        password: frrPassword,
        networks: frrNetworks,
      });
    }
    if (isKeycloakService(serviceType)) {
      return buildKeycloakConfig({
        realm: kcRealm,
        adminUsername: kcAdminUser,
        adminPassword: kcAdminPass,
        publicBaseUrl: kcPublicBaseUrl,
        guiClientSecret: kcGuiSecret,
      });
    }
    if (isAuthGatewayService(serviceType)) {
      return buildAuthGatewayConfig({
        upstreamUrl: gwUpstream,
        oidcIssuerUrl: gwIssuer,
        clientId: gwClientId,
        clientSecret: gwClientSecret,
      });
    }
    return buildHaproxyConfig({
      mode,
      bindPort,
      serverAddress,
      serverPort,
    });
  }, [
    serviceType,
    frrHostname,
    name,
    frrRouterId,
    attachments,
    frrLocalAs,
    frrNeighbor,
    frrRemoteAs,
    frrPassword,
    frrNetworks,
    kcRealm,
    kcAdminUser,
    kcAdminPass,
    kcPublicBaseUrl,
    kcGuiSecret,
    gwUpstream,
    gwIssuer,
    gwClientId,
    gwClientSecret,
    mode,
    bindPort,
    serverAddress,
    serverPort,
  ]);

  function canNext(): boolean {
    if (step === 1) return Boolean(selectedDef?.enabled);
    if (step === 2) return name.trim().length > 0;
    if (step === 3) {
      if (isKeycloakService(serviceType) || isAuthGatewayService(serviceType)) {
        return attachments.some((item) => item.network_id);
      }
      return true;
    }
    if (step === 4) {
      if (isKeycloakService(serviceType) || isAuthGatewayService(serviceType)) {
        return attachments.some((item) => item.network_id && item.ip_address.trim());
      }
      return attachments.every(
        (item) => !item.network_id || item.network_id.length > 0,
      );
    }
    if (step === 5) {
      if (serviceType === "frr") {
        const hasIp = attachments.some((item) => item.ip_address.trim());
        return frrLocalAs > 0 && (Boolean(frrRouterId.trim()) || hasIp);
      }
      if (isKeycloakService(serviceType)) {
        return Boolean(kcRealm.trim() && kcAdminUser.trim() && kcAdminPass.trim());
      }
      if (isAuthGatewayService(serviceType)) {
        return Boolean(gwUpstream.trim() && gwIssuer.trim() && gwClientId.trim() && gwClientSecret.trim());
      }
      return bindPort > 0 && serverPort > 0;
    }
    if (step === 6) return Boolean(validation?.ok);
    return true;
  }

  async function runValidate() {
    const result = await validateMutation.mutateAsync({
      service_type: serviceType,
      image_version: version,
      configuration,
    });
    setValidation(result);
  }

  async function onCreate() {
    const networksPayload = attachments
      .filter((item) => item.network_id)
      .map((item) => ({
        network_id: item.network_id,
        ip_address: item.ip_address.trim() || null,
      }));

    const created = await createMutation.mutateAsync({
      name: name.trim(),
      service_type: serviceType,
      image_version: version,
      desired_state: desiredRunning ? "running" : "stopped",
      configuration,
      networks: networksPayload,
    });
    navigate(instanceDetailPath(created.id, created.service_type));
  }

  if (!canMutate) {
    return <Navigate to="/instances" replace />;
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-xs tracking-wide text-accent uppercase">
          <Link to="/catalog" className="hover:underline">
            {t("catalog.title")}
          </Link>
          {" / "}
          {t("wizard.title")}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{t("wizard.title")}</h2>
        <p className="mt-1 text-ink-muted">
          {t("wizard.stepOf", { step, total: STEPS })} — {t(`wizard.steps.${step}`)}
        </p>
        <div className="mt-4 flex gap-1" aria-hidden>
          {Array.from({ length: STEPS }, (_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 ${index + 1 <= step ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
      </section>

      <div className="border border-line bg-paper-elevated p-5 shadow-sm">
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">{t("wizard.pickService")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {enabledServices.map((service) => (
                <button
                  key={service.service_type}
                  type="button"
                  onClick={() => {
                    setServiceType(service.service_type);
                    setImageVersion(service.default_version);
                    setValidation(null);
                  }}
                  className={`border px-4 py-3 text-left ${
                    serviceType === service.service_type
                      ? "border-accent bg-accent-soft/40"
                      : "border-line"
                  }`}
                >
                  <span className="font-medium text-ink">{service.display_name}</span>
                  <span className="mt-1 block text-xs text-ink-muted">{service.description}</span>
                </button>
              ))}
            </div>
            {!selectedDef?.enabled ? (
              <p className="text-sm text-danger">{t("wizard.serviceDisabled")}</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink-muted">{t("wizard.name")}</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                placeholder="edge-haproxy-1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("wizard.version")}</span>
              <input
                value={imageVersion || selectedDef?.default_version || ""}
                onChange={(e) => setImageVersion(e.target.value)}
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                placeholder={selectedDef?.default_version}
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              {serviceType === "keycloak-mgmt"
                ? t("keycloak.mgmtNetworksHint")
                : t("wizard.networksHint")}
            </p>
            {serviceType === "keycloak-mgmt" && networks.length === 0 ? (
              <p className="text-sm text-danger">{t("keycloak.noMgmtNetworks")}</p>
            ) : null}
            {attachments.map((attachment, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="block text-sm">
                  <span className="text-ink-muted">
                    {t("wizard.network")} #{index + 1}
                  </span>
                  <select
                    value={attachment.network_id}
                    onChange={(e) => {
                      const next = [...attachments];
                      next[index] = { ...next[index], network_id: e.target.value };
                      setAttachments(next);
                    }}
                    className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  >
                    <option value="">{t("wizard.noNetwork")}</option>
                    {networks.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name} ({network.network_type}
                        {network.subnet ? ` · ${network.subnet}` : ""})
                      </option>
                    ))}
                  </select>
                </label>
                {attachments.length > 1 ? (
                  <button
                    type="button"
                    className="self-end text-sm text-danger hover:underline"
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                  >
                    {t("wizard.remove")}
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-accent hover:underline"
              onClick={() => setAttachments([...attachments, { network_id: "", ip_address: "" }])}
            >
              {t("wizard.addNetwork")}
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">{t("wizard.ipsHint")}</p>
            {attachments.map((attachment, index) => {
              const network = networks.find((item) => item.id === attachment.network_id);
              if (!attachment.network_id) {
                return (
                  <p key={index} className="font-mono text-xs text-ink-muted">
                    {t("wizard.skipIp")} #{index + 1}
                  </p>
                );
              }
              return (
                <label key={index} className="block text-sm">
                  <span className="text-ink-muted">
                    {network?.name ?? attachment.network_id}
                    {network?.subnet ? ` (${network.subnet})` : ""}
                  </span>
                  <input
                    value={attachment.ip_address}
                    onChange={(e) => {
                      const next = [...attachments];
                      next[index] = { ...next[index], ip_address: e.target.value };
                      setAttachments(next);
                    }}
                    className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                    placeholder={
                      network?.gateway
                        ? network.gateway.replace(/\.\d+$/, ".10")
                        : "172.30.60.10"
                    }
                  />
                </label>
              );
            })}
          </div>
        ) : null}

        {step === 5 ? (
          isKeycloakService(serviceType) ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-ink-muted">{t("keycloak.realm")}</span>
                <input
                  value={kcRealm}
                  onChange={(e) => setKcRealm(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("keycloak.publicBaseUrl")}</span>
                <input
                  value={kcPublicBaseUrl}
                  onChange={(e) => setKcPublicBaseUrl(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  placeholder="http://192.168.50.195"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("keycloak.adminUsername")}</span>
                <input
                  value={kcAdminUser}
                  onChange={(e) => setKcAdminUser(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("keycloak.adminPassword")}</span>
                <input
                  type="password"
                  value={kcAdminPass}
                  onChange={(e) => setKcAdminPass(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              {serviceType === "keycloak-mgmt" ? (
                <label className="block text-sm md:col-span-2">
                  <span className="text-ink-muted">{t("keycloak.guiClientSecret")}</span>
                  <input
                    value={kcGuiSecret}
                    onChange={(e) => setKcGuiSecret(e.target.value)}
                    className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  />
                </label>
              ) : null}
              <p className="text-sm text-ink-muted md:col-span-2">{t("keycloak.configHint")}</p>
            </div>
          ) : isAuthGatewayService(serviceType) ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="text-ink-muted">{t("authGateway.upstream")}</span>
                <input
                  value={gwUpstream}
                  onChange={(e) => setGwUpstream(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  placeholder="http://192.168.50.10:80"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="text-ink-muted">{t("authGateway.issuer")}</span>
                <input
                  value={gwIssuer}
                  onChange={(e) => setGwIssuer(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  placeholder="http://10.0.0.20:8080/realms/axionet"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("authGateway.clientId")}</span>
                <input
                  value={gwClientId}
                  onChange={(e) => setGwClientId(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("authGateway.clientSecret")}</span>
                <input
                  type="password"
                  value={gwClientSecret}
                  onChange={(e) => setGwClientSecret(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <p className="text-sm text-ink-muted md:col-span-2">{t("authGateway.configHint")}</p>
            </div>
          ) : serviceType === "frr" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.hostname")}</span>
                <input
                  value={frrHostname}
                  onChange={(e) => setFrrHostname(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.routerId")}</span>
                <input
                  value={frrRouterId}
                  onChange={(e) => setFrrRouterId(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  placeholder={
                    attachments.map((item) => item.ip_address.trim()).find(Boolean)?.split("/")[0] ||
                    "192.168.21.2"
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.localAs")}</span>
                <input
                  type="number"
                  value={frrLocalAs}
                  onChange={(e) => setFrrLocalAs(Number(e.target.value))}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.neighborAddress")}</span>
                <input
                  value={frrNeighbor}
                  onChange={(e) => setFrrNeighbor(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                  placeholder="10.50.10.1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.remoteAs")}</span>
                <input
                  type="number"
                  value={frrRemoteAs}
                  onChange={(e) => setFrrRemoteAs(Number(e.target.value))}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">{t("frr.password")}</span>
                <input
                  value={frrPassword}
                  onChange={(e) => setFrrPassword(e.target.value)}
                  className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="text-ink-muted">{t("frr.networks")}</span>
                <textarea
                  value={frrNetworks}
                  onChange={(e) => setFrrNetworks(e.target.value)}
                  className="mt-1 h-24 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
            </div>
          ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-ink-muted">{t("wizard.mode")}</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "http" | "tcp")}
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
              >
                <option value="http">http</option>
                <option value="tcp">tcp</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("wizard.bindPort")}</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={bindPort}
                onChange={(e) => setBindPort(Number(e.target.value))}
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("wizard.serverAddress")}</span>
              <input
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("wizard.serverPort")}</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={serverPort}
                onChange={(e) => setServerPort(Number(e.target.value))}
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
              />
            </label>
          </div>
          )
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <button
              type="button"
              disabled={validateMutation.isPending}
              onClick={() => void runValidate()}
              className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {validateMutation.isPending ? t("wizard.validating") : t("wizard.validate")}
            </button>
            {validateMutation.isError ? (
              <p className="text-sm text-danger">
                {validateMutation.error instanceof Error
                  ? validateMutation.error.message
                  : t("common.unknownError")}
              </p>
            ) : null}
            {validation ? (
              <div className="space-y-3">
                <p className={`font-mono text-sm ${validation.ok ? "text-ok" : "text-danger"}`}>
                  {validation.ok ? t("wizard.validOk") : t("wizard.validFail")}
                </p>
                <pre className="max-h-40 overflow-auto bg-ink px-3 py-3 font-mono text-xs text-paper">
                  {validation.output}
                </pre>
                {validation.rendered_preview ? (
                  <pre className="max-h-64 overflow-auto border border-line bg-paper px-3 py-3 font-mono text-xs text-ink">
                    {validation.rendered_preview}
                  </pre>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{t("wizard.validateHint")}</p>
            )}
          </div>
        ) : null}

        {step === 7 ? (
          <div className="space-y-4">
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                <dt className="text-ink-muted">{t("wizard.name")}</dt>
                <dd className="font-mono">{name}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("wizard.version")}</dt>
                <dd className="font-mono">
                  {selectedDef?.container_image ?? serviceType}:{version}
                </dd>
              </div>
              {isKeycloakService(serviceType) ? (
                <>
                  <div>
                    <dt className="text-ink-muted">{t("keycloak.realm")}</dt>
                    <dd className="font-mono">{kcRealm}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("keycloak.publicBaseUrl")}</dt>
                    <dd className="font-mono">{kcPublicBaseUrl || "—"}</dd>
                  </div>
                </>
              ) : isAuthGatewayService(serviceType) ? (
                <>
                  <div>
                    <dt className="text-ink-muted">{t("authGateway.upstream")}</dt>
                    <dd className="font-mono break-all">{gwUpstream}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("authGateway.issuer")}</dt>
                    <dd className="font-mono break-all">{gwIssuer}</dd>
                  </div>
                </>
              ) : serviceType === "frr" ? (
                <>
                  <div>
                    <dt className="text-ink-muted">{t("frr.localAs")}</dt>
                    <dd className="font-mono">{frrLocalAs}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("frr.neighborAddress")}</dt>
                    <dd className="font-mono">{frrNeighbor || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("frr.remoteAs")}</dt>
                    <dd className="font-mono">{frrRemoteAs}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("frr.networks")}</dt>
                    <dd className="font-mono whitespace-pre-wrap">{frrNetworks || "—"}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-ink-muted">{t("wizard.bindPort")}</dt>
                    <dd className="font-mono">{bindPort}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("wizard.serverAddress")}</dt>
                    <dd className="font-mono">
                      {serverAddress}:{serverPort}
                    </dd>
                  </div>
                </>
              )}
              <div className="md:col-span-2">
                <dt className="text-ink-muted">{t("wizard.network")}</dt>
                <dd className="font-mono text-xs">
                  {attachments
                    .filter((item) => item.network_id)
                    .map((item) => {
                      const network = networks.find((net) => net.id === item.network_id);
                      return `${network?.name ?? item.network_id}${item.ip_address ? ` @ ${item.ip_address}` : ""}`;
                    })
                    .join(", ") || "—"}
                </dd>
              </div>
            </dl>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={desiredRunning}
                onChange={(e) => setDesiredRunning(e.target.checked)}
              />
              {t("wizard.startNow")}
            </label>
            {createMutation.isError ? (
              <p className="text-sm text-danger">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : t("common.unknownError")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          {step > 1 ? (
            <button
              type="button"
              className="border border-line px-4 py-2 text-sm text-ink hover:border-accent"
              onClick={() => {
                setStep((value) => value - 1);
                if (step === 7) setValidation(null);
              }}
            >
              {t("wizard.back")}
            </button>
          ) : (
            <Link to="/catalog" className="border border-line px-4 py-2 text-sm text-ink-muted">
              {t("wizard.cancel")}
            </Link>
          )}
        </div>
        <div>
          {step < STEPS ? (
            <button
              type="button"
              disabled={!canNext()}
              className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => {
                if (step === 5) setValidation(null);
                setStep((value) => value + 1);
              }}
            >
              {t("wizard.next")}
            </button>
          ) : (
            <button
              type="button"
              disabled={createMutation.isPending || !validation?.ok}
              className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => void onCreate()}
            >
              {createMutation.isPending ? t("wizard.creating") : t("wizard.create")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
