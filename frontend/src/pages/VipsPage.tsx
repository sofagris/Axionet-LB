import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInstances } from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";
import {
  useCreateVip,
  useDeleteVip,
  useDisableVip,
  useEnableVip,
  useVips,
} from "../features/vips/hooks";
import { instanceDetailPath } from "../lib/instancePaths";

export function VipsPage() {
  const { t } = useTranslation();
  const vipsQuery = useVips();
  const instancesQuery = useInstances();
  const networksQuery = useNetworks();
  const createMutation = useCreateVip();
  const enableMutation = useEnableVip();
  const disableMutation = useDisableVip();
  const deleteMutation = useDeleteVip();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<"same_l2" | "routed">("same_l2");
  const [backendIp, setBackendIp] = useState("");
  const [haproxyId, setHaproxyId] = useState("");
  const [frrId, setFrrId] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [bindFrontends, setBindFrontends] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const haproxyInstances = useMemo(
    () => (instancesQuery.data ?? []).filter((item) => item.service_type === "haproxy"),
    [instancesQuery.data],
  );
  const frrInstances = useMemo(
    () => (instancesQuery.data ?? []).filter((item) => item.service_type === "frr"),
    [instancesQuery.data],
  );
  const instanceName = (id: string) =>
    instancesQuery.data?.find((item) => item.id === id)?.name ?? id.slice(0, 8);
  const networkName = (id: string) =>
    networksQuery.data?.find((item) => item.id === id)?.name ?? id.slice(0, 8);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        address: address.trim(),
        haproxy_instance_id: haproxyId,
        frr_instance_id: frrId,
        network_id: networkId,
        mode,
        backend_ip: mode === "routed" && backendIp.trim() ? backendIp.trim() : null,
        enabled: true,
        advertise: true,
        bind_frontends: mode === "same_l2" ? bindFrontends : false,
      });
      setName("");
      setAddress("");
      setBackendIp("");
      setBindFrontends(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("common.unknownError"));
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("vips.title")}</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("vips.subtitle")}</p>
      </section>

      <section className="border border-line bg-paper-elevated p-4 shadow-sm">
        <h3 className="text-sm font-medium tracking-wide text-ink uppercase">
          {t("vips.createTitle")}
        </h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("vips.colName")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("vips.colAddress")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-ink"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={mode === "routed" ? "203.0.113.10" : "192.168.22.10"}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("vips.colMode")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={mode}
              onChange={(event) => setMode(event.target.value as "same_l2" | "routed")}
            >
              <option value="same_l2">{t("vips.modeSameL2")}</option>
              <option value="routed">{t("vips.modeRouted")}</option>
            </select>
          </label>
          {mode === "routed" ? (
            <label className="block text-sm md:col-span-2">
              <span className="text-ink-muted">{t("vips.colBackendIp")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-ink"
                value={backendIp}
                onChange={(event) => setBackendIp(event.target.value)}
                placeholder={t("vips.backendIpHint")}
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-ink-muted">{t("vips.colHaproxy")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={haproxyId}
              onChange={(event) => setHaproxyId(event.target.value)}
              required
            >
              <option value="">{t("vips.selectInstance")}</option>
              {haproxyInstances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("vips.colFrr")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={frrId}
              onChange={(event) => setFrrId(event.target.value)}
              required
            >
              <option value="">{t("vips.selectInstance")}</option>
              {frrInstances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-ink-muted">{t("vips.colNetwork")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={networkId}
              onChange={(event) => setNetworkId(event.target.value)}
              required
            >
              <option value="">{t("vips.selectNetwork")}</option>
              {(networksQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.subnet ? ` (${item.subnet})` : ""}
                </option>
              ))}
            </select>
          </label>
          {mode === "same_l2" ? (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={bindFrontends}
                onChange={(event) => setBindFrontends(event.target.checked)}
              />
              <span className="text-ink-muted">{t("vips.bindFrontends")}</span>
            </label>
          ) : null}
          {formError ? <p className="text-sm text-danger md:col-span-2">{formError}</p> : null}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {createMutation.isPending ? t("common.saving") : t("vips.create")}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-x-auto border border-line bg-paper-elevated p-4 shadow-sm">
        {vipsQuery.isLoading ? (
          <p className="text-ink-muted">{t("common.loading")}</p>
        ) : !vipsQuery.data?.length ? (
          <p className="text-ink-muted">{t("vips.empty")}</p>
        ) : (
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="text-xs tracking-wide text-ink-muted uppercase">
                <th className="pb-2 pr-4 font-medium">{t("vips.colName")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colMode")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colAddress")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colHaproxy")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colFrr")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colNetwork")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colStatus")}</th>
                <th className="pb-2 font-medium">{t("vips.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {vipsQuery.data.map((vip) => (
                <tr key={vip.id} className="border-t border-line/70">
                  <td className="py-3 pr-4 font-medium text-ink">{vip.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink">
                    {vip.mode === "routed" ? t("vips.modeRouted") : t("vips.modeSameL2")}
                  </td>
                  <td className="py-3 pr-4 font-mono text-ink">
                    {vip.address}
                    {vip.announce_prefix ? (
                      <span className="ml-2 text-xs text-ink-muted">{vip.announce_prefix}</span>
                    ) : null}
                    {vip.mode === "routed" && vip.backend_ip ? (
                      <div className="text-xs text-ink-muted">→ {vip.backend_ip}</div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      className="text-accent hover:underline"
                      to={instanceDetailPath(vip.haproxy_instance_id, "haproxy")}
                    >
                      {instanceName(vip.haproxy_instance_id)}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      className="text-accent hover:underline"
                      to={instanceDetailPath(vip.frr_instance_id, "frr")}
                    >
                      {instanceName(vip.frr_instance_id)}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink">{networkName(vip.network_id)}</td>
                  <td className="py-3 pr-4 text-xs">
                    <div className={vip.enabled ? "text-ok" : "text-ink-muted"}>
                      {vip.enabled ? t("vips.enabled") : t("vips.disabled")}
                    </div>
                    {vip.mode === "same_l2" ? (
                      <div className={vip.attached ? "text-ok" : "text-warn"}>
                        {vip.attached ? t("vips.attached") : t("vips.notAttached")}
                      </div>
                    ) : (
                      <div className={vip.dataplane_ready ? "text-ok" : "text-warn"}>
                        {vip.dataplane_ready ? t("vips.dataplaneReady") : t("vips.dataplaneNotReady")}
                      </div>
                    )}
                    <div className={vip.advertised ? "text-ok" : "text-ink-muted"}>
                      {vip.advertised ? t("vips.advertised") : t("vips.notAdvertised")}
                    </div>
                    {vip.enabled && vip.advertise && !vip.advertised ? (
                      <div className="mt-1 text-warn">{t("vips.withdrawnHealth")}</div>
                    ) : null}
                    {vip.last_error ? (
                      <div className="mt-1 max-w-xs truncate text-danger" title={vip.last_error}>
                        {vip.last_error}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {vip.enabled ? (
                        <button
                          type="button"
                          className="border border-line px-2 py-1 text-xs hover:border-accent"
                          disabled={disableMutation.isPending}
                          onClick={() => disableMutation.mutate(vip.id)}
                        >
                          {t("vips.disable")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="border border-line px-2 py-1 text-xs hover:border-accent"
                          disabled={enableMutation.isPending}
                          onClick={() => enableMutation.mutate(vip.id)}
                        >
                          {t("vips.enable")}
                        </button>
                      )}
                      <Link
                        className="border border-line px-2 py-1 text-xs hover:border-accent"
                        to={instanceDetailPath(vip.frr_instance_id, "frr")}
                      >
                        {t("vips.bgpLink")}
                      </Link>
                      <button
                        type="button"
                        className="border border-line px-2 py-1 text-xs text-danger hover:border-danger"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(t("vips.confirmDelete", { name: vip.name }))) {
                            deleteMutation.mutate(vip.id);
                          }
                        }}
                      >
                        {t("vips.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
