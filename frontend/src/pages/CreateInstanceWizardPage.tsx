import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useServiceDefinitions } from "../features/catalog/hooks";
import { useCreateInstance, useValidateInstanceConfig } from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";
import type { InstanceValidateResult } from "../types/instances";

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

export function CreateInstanceWizardPage() {
  const { t } = useTranslation();
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
  const [validation, setValidation] = useState<InstanceValidateResult | null>(null);
  const [desiredRunning, setDesiredRunning] = useState(false);

  const selectedDef = (catalogQuery.data ?? []).find((item) => item.service_type === serviceType);
  const version = imageVersion || selectedDef?.default_version || "3.2.6";
  const networks = networksQuery.data ?? [];

  const configuration = useMemo(
    () =>
      buildHaproxyConfig({
        mode,
        bindPort,
        serverAddress,
        serverPort,
      }),
    [mode, bindPort, serverAddress, serverPort],
  );

  function canNext(): boolean {
    if (step === 1) return Boolean(selectedDef?.enabled);
    if (step === 2) return name.trim().length > 0;
    if (step === 3) return true;
    if (step === 4) {
      return attachments.every(
        (item) => !item.network_id || item.network_id.length > 0,
      );
    }
    if (step === 5) return bindPort > 0 && serverPort > 0;
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
    navigate(`/instances/${created.id}/haproxy`);
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
            <p className="text-sm text-ink-muted">{t("wizard.networksHint")}</p>
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
                  {serviceType}:{version}
                </dd>
              </div>
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
