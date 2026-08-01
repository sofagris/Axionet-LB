import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MutationGate } from "../components/MutationGate";
import { useInstances } from "../features/instances/hooks";
import { useNetworks } from "../features/networks/hooks";
import {
  useAddVipLink,
  useCreateVip,
  useDeleteVip,
  useDisableVip,
  useEnableVip,
  useRemoveVipLink,
  useVips,
} from "../features/vips/hooks";
import { instanceDetailPath } from "../lib/instancePaths";
import type { Vip } from "../types/vips";

type ExtraLinkDraft = { frr_instance_id: string; network_id: string };

export function VipsPage() {
  const { t } = useTranslation();
  const vipsQuery = useVips();
  const instancesQuery = useInstances();
  const networksQuery = useNetworks();
  const createMutation = useCreateVip();
  const enableMutation = useEnableVip();
  const disableMutation = useDisableVip();
  const deleteMutation = useDeleteVip();
  const addLinkMutation = useAddVipLink();
  const removeLinkMutation = useRemoveVipLink();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<"same_l2" | "routed">("same_l2");
  const [backendIp, setBackendIp] = useState("");
  const [haproxyId, setHaproxyId] = useState("");
  const [frrId, setFrrId] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [extraLinks, setExtraLinks] = useState<ExtraLinkDraft[]>([]);
  const [bindFrontends, setBindFrontends] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [linkVipId, setLinkVipId] = useState<string | null>(null);
  const [linkFrrId, setLinkFrrId] = useState("");
  const [linkNetworkId, setLinkNetworkId] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

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
      const links = extraLinks.filter((item) => item.frr_instance_id && item.network_id);
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
        links,
      });
      setName("");
      setAddress("");
      setBackendIp("");
      setBindFrontends(false);
      setExtraLinks([]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("common.unknownError"));
    }
  }

  async function onAddLink(vip: Vip) {
    setLinkError(null);
    if (!linkFrrId || !linkNetworkId) {
      setLinkError(t("vips.linkRequired"));
      return;
    }
    try {
      await addLinkMutation.mutateAsync({
        vipId: vip.id,
        payload: { frr_instance_id: linkFrrId, network_id: linkNetworkId },
      });
      setLinkVipId(null);
      setLinkFrrId("");
      setLinkNetworkId("");
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : t("common.unknownError"));
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("vips.title")}</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("vips.subtitle")}</p>
      </section>

      <MutationGate>
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

          <div className="space-y-2 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">{t("vips.extraLinksTitle")}</p>
              <button
                type="button"
                className="border border-line px-2 py-1 text-xs text-ink hover:border-accent"
                onClick={() =>
                  setExtraLinks((current) => [...current, { frr_instance_id: "", network_id: "" }])
                }
              >
                {t("vips.addLink")}
              </button>
            </div>
            <p className="text-xs text-ink-muted">{t("vips.extraLinksHint")}</p>
            {extraLinks.map((link, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <select
                  className="border border-line bg-paper px-3 py-2 text-sm text-ink"
                  value={link.frr_instance_id}
                  onChange={(event) => {
                    const value = event.target.value;
                    setExtraLinks((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, frr_instance_id: value } : item,
                      ),
                    );
                  }}
                >
                  <option value="">{t("vips.selectInstance")}</option>
                  {frrInstances.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  className="border border-line bg-paper px-3 py-2 text-sm text-ink"
                  value={link.network_id}
                  onChange={(event) => {
                    const value = event.target.value;
                    setExtraLinks((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, network_id: value } : item,
                      ),
                    );
                  }}
                >
                  <option value="">{t("vips.selectNetwork")}</option>
                  {(networksQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="border border-line px-2 py-1 text-xs text-danger"
                  onClick={() =>
                    setExtraLinks((current) => current.filter((_, i) => i !== index))
                  }
                >
                  {t("vips.removeLink")}
                </button>
              </div>
            ))}
          </div>

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
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="text-xs tracking-wide text-ink-muted uppercase">
                <th className="pb-2 pr-4 font-medium">{t("vips.colName")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colMode")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colAddress")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colHaproxy")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colLinks")}</th>
                <th className="pb-2 pr-4 font-medium">{t("vips.colStatus")}</th>
                <th className="pb-2 font-medium">{t("vips.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {vipsQuery.data.map((vip) => {
                const links = vip.links?.length
                  ? vip.links
                  : [
                      {
                        id: "primary",
                        vip_id: vip.id,
                        frr_instance_id: vip.frr_instance_id,
                        network_id: vip.network_id,
                        attached: vip.attached,
                        dataplane_ready: vip.dataplane_ready,
                        advertised: vip.advertised,
                        created_at: vip.created_at,
                        updated_at: vip.updated_at,
                      },
                    ];
                return (
                  <tr key={vip.id} className="border-t border-line/70 align-top">
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
                      <ul className="space-y-1.5 text-xs">
                        {links.map((link) => (
                          <li key={link.id} className="border border-line/70 bg-paper px-2 py-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <Link
                                  className="text-accent hover:underline"
                                  to={instanceDetailPath(link.frr_instance_id, "frr")}
                                >
                                  {instanceName(link.frr_instance_id)}
                                </Link>
                                <span className="text-ink-muted">
                                  {" "}
                                  · {networkName(link.network_id)}
                                </span>
                              </div>
                              {links.length > 1 && link.id !== "primary" ? (
                                <button
                                  type="button"
                                  className="text-danger hover:underline"
                                  disabled={removeLinkMutation.isPending}
                                  onClick={() =>
                                    void removeLinkMutation.mutateAsync({
                                      vipId: vip.id,
                                      linkId: link.id,
                                    })
                                  }
                                >
                                  {t("vips.removeLink")}
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1 text-ink-muted">
                              {link.advertised ? t("vips.advertised") : t("vips.notAdvertised")}
                              {vip.mode === "routed" ? (
                                <>
                                  {" · "}
                                  {link.dataplane_ready
                                    ? t("vips.dataplaneReady")
                                    : t("vips.dataplaneNotReady")}
                                </>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {linkVipId === vip.id ? (
                        <div className="mt-2 space-y-2 border border-line bg-paper p-2">
                          <select
                            className="w-full border border-line bg-paper px-2 py-1 text-xs"
                            value={linkFrrId}
                            onChange={(event) => setLinkFrrId(event.target.value)}
                          >
                            <option value="">{t("vips.selectInstance")}</option>
                            {frrInstances.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-full border border-line bg-paper px-2 py-1 text-xs"
                            value={linkNetworkId}
                            onChange={(event) => setLinkNetworkId(event.target.value)}
                          >
                            <option value="">{t("vips.selectNetwork")}</option>
                            {(networksQuery.data ?? []).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          {linkError ? <p className="text-danger">{linkError}</p> : null}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="border border-accent px-2 py-1 text-xs text-accent"
                              disabled={addLinkMutation.isPending}
                              onClick={() => void onAddLink(vip)}
                            >
                              {t("vips.saveLink")}
                            </button>
                            <button
                              type="button"
                              className="border border-line px-2 py-1 text-xs text-ink-muted"
                              onClick={() => {
                                setLinkVipId(null);
                                setLinkError(null);
                              }}
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 text-xs text-accent hover:underline"
                          onClick={() => {
                            setLinkVipId(vip.id);
                            setLinkFrrId("");
                            setLinkNetworkId("");
                            setLinkError(null);
                          }}
                        >
                          {t("vips.addLink")}
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <div className={vip.enabled ? "text-ok" : "text-ink-muted"}>
                        {vip.enabled ? t("vips.enabled") : t("vips.disabled")}
                      </div>
                      <div className="text-ink-muted">
                        {t("vips.linkCount", { count: links.length })}
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
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      </MutationGate>
    </div>
  );
}
