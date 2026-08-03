import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../auth/usePermissions";
import {
  useInventoryMutations,
  useLoadBalancers,
  usePlacementDomains,
  useSites,
} from "../inventory/hooks";
import type { LoadBalancer, PlacementDomainRecord, Site } from "../../types/inventory";

export function InventorySettings() {
  const { t } = useTranslation();
  const { isAdmin } = usePermissions();
  const sitesQuery = useSites();
  const domainsQuery = usePlacementDomains();
  const lbsQuery = useLoadBalancers();
  const mutations = useInventoryMutations();

  const sites = sitesQuery.data ?? [];
  const domains = domainsQuery.data ?? [];
  const lbs = lbsQuery.data ?? [];

  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  const [domainName, setDomainName] = useState("");
  const [domainKind, setDomainKind] = useState<"site" | "shared">("site");
  const [domainDescription, setDomainDescription] = useState("");
  const [domainSiteId, setDomainSiteId] = useState("");
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);

  const [lbName, setLbName] = useState("");
  const [lbDescription, setLbDescription] = useState("");
  const [lbIp, setLbIp] = useState("");
  const [lbSiteId, setLbSiteId] = useState("");
  const [editingLbId, setEditingLbId] = useState<string | null>(null);

  const siteNameById = (id: string | null) =>
    id ? (sites.find((s) => s.id === id)?.name ?? "—") : "—";

  async function submitSite(event: FormEvent) {
    event.preventDefault();
    if (!siteName.trim()) return;
    if (editingSiteId) {
      await mutations.updateSite.mutateAsync({
        id: editingSiteId,
        payload: { name: siteName.trim(), description: siteDescription.trim() || null },
      });
    } else {
      await mutations.createSite.mutateAsync({
        name: siteName.trim(),
        description: siteDescription.trim() || null,
      });
    }
    setSiteName("");
    setSiteDescription("");
    setEditingSiteId(null);
  }

  function startEditSite(site: Site) {
    setEditingSiteId(site.id);
    setSiteName(site.name);
    setSiteDescription(site.description ?? "");
  }

  async function submitDomain(event: FormEvent) {
    event.preventDefault();
    if (!domainName.trim()) return;
    const payload = {
      name: domainName.trim(),
      kind: domainKind,
      description: domainDescription.trim() || null,
      site_id: domainKind === "site" && domainSiteId ? domainSiteId : null,
    };
    if (editingDomainId) {
      await mutations.updatePlacementDomain.mutateAsync({ id: editingDomainId, payload });
    } else {
      await mutations.createPlacementDomain.mutateAsync(payload);
    }
    setDomainName("");
    setDomainKind("site");
    setDomainDescription("");
    setDomainSiteId("");
    setEditingDomainId(null);
  }

  function startEditDomain(domain: PlacementDomainRecord) {
    setEditingDomainId(domain.id);
    setDomainName(domain.name);
    setDomainKind(domain.kind);
    setDomainDescription(domain.description ?? "");
    setDomainSiteId(domain.site_id ?? "");
  }

  async function submitLb(event: FormEvent) {
    event.preventDefault();
    if (!lbName.trim()) return;
    const payload = {
      name: lbName.trim(),
      description: lbDescription.trim() || null,
      ip_address: lbIp.trim() || null,
      site_id: lbSiteId || null,
    };
    if (editingLbId) {
      await mutations.updateLoadBalancer.mutateAsync({ id: editingLbId, payload });
    } else {
      await mutations.createLoadBalancer.mutateAsync(payload);
    }
    setLbName("");
    setLbDescription("");
    setLbIp("");
    setLbSiteId("");
    setEditingLbId(null);
  }

  function startEditLb(lb: LoadBalancer) {
    setEditingLbId(lb.id);
    setLbName(lb.name);
    setLbDescription(lb.description ?? "");
    setLbIp(lb.ip_address ?? "");
    setLbSiteId(lb.site_id ?? "");
  }

  const err = (error: unknown) =>
    error instanceof Error ? error.message : t("common.unknownError");

  return (
    <section id="sites" className="scroll-mt-20 space-y-8 border border-line bg-paper-elevated p-5 shadow-sm">
      <div>
        <h3 className="font-semibold text-ink">{t("settings.inventory.title")}</h3>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">{t("settings.inventory.subtitle")}</p>
      </div>

      {/* Sites */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-ink">{t("settings.inventory.sites")}</h4>
        {sitesQuery.isLoading ? <p className="text-sm text-ink-muted">{t("common.loading")}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colName")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colDescription")}</th>
                {isAdmin ? <th className="py-2 font-medium">{t("common.actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} className="border-b border-line/60">
                  <td className="py-2 pr-3 font-mono text-ink">{site.name}</td>
                  <td className="py-2 pr-3 text-ink-muted">{site.description || "—"}</td>
                  {isAdmin ? (
                    <td className="py-2 space-x-2">
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => startEditSite(site)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        onClick={() => {
                          if (!window.confirm(t("settings.inventory.confirmDeleteSite"))) return;
                          void mutations.deleteSite.mutateAsync(site.id);
                        }}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {sites.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 3 : 2} className="py-3 text-ink-muted">
                    {t("settings.inventory.emptySites")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {isAdmin ? (
          <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => void submitSite(e)}>
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              placeholder={t("settings.inventory.siteNamePlaceholder")}
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              required
            />
            <input
              className="border border-line bg-paper px-3 py-2 text-sm"
              placeholder={t("settings.inventory.descriptionPlaceholder")}
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingSiteId ? t("common.save") : t("settings.inventory.addSite")}
              </button>
              {editingSiteId ? (
                <button
                  type="button"
                  className="border border-line px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingSiteId(null);
                    setSiteName("");
                    setSiteDescription("");
                  }}
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
        {mutations.createSite.isError || mutations.updateSite.isError || mutations.deleteSite.isError ? (
          <p className="text-sm text-danger">
            {err(
              mutations.createSite.error ??
                mutations.updateSite.error ??
                mutations.deleteSite.error,
            )}
          </p>
        ) : null}
      </div>

      {/* Placement domains */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-ink">{t("settings.inventory.placementDomains")}</h4>
        {domainsQuery.isLoading ? <p className="text-sm text-ink-muted">{t("common.loading")}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colName")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colKind")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colSite")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colDescription")}</th>
                {isAdmin ? <th className="py-2 font-medium">{t("common.actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id} className="border-b border-line/60">
                  <td className="py-2 pr-3 font-mono text-ink">{domain.name}</td>
                  <td className="py-2 pr-3 text-ink-muted">{domain.kind}</td>
                  <td className="py-2 pr-3 text-ink-muted">{siteNameById(domain.site_id)}</td>
                  <td className="py-2 pr-3 text-ink-muted">{domain.description || "—"}</td>
                  {isAdmin ? (
                    <td className="py-2 space-x-2">
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => startEditDomain(domain)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        onClick={() => {
                          if (!window.confirm(t("settings.inventory.confirmDeleteDomain"))) return;
                          void mutations.deletePlacementDomain.mutateAsync(domain.id);
                        }}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="py-3 text-ink-muted">
                    {t("settings.inventory.emptyDomains")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {isAdmin ? (
          <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => void submitDomain(e)}>
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              placeholder={t("settings.inventory.domainNamePlaceholder")}
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              required
            />
            <select
              className="border border-line bg-paper px-3 py-2 text-sm"
              value={domainKind}
              onChange={(e) => setDomainKind(e.target.value as "site" | "shared")}
            >
              <option value="site">{t("designer.placement.kindSite")}</option>
              <option value="shared">{t("designer.placement.kindShared")}</option>
            </select>
            <select
              className="border border-line bg-paper px-3 py-2 text-sm"
              value={domainSiteId}
              onChange={(e) => setDomainSiteId(e.target.value)}
              disabled={domainKind !== "site"}
            >
              <option value="">{t("settings.inventory.noSite")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              className="border border-line bg-paper px-3 py-2 text-sm"
              placeholder={t("settings.inventory.descriptionPlaceholder")}
              value={domainDescription}
              onChange={(e) => setDomainDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingDomainId ? t("common.save") : t("settings.inventory.addDomain")}
              </button>
              {editingDomainId ? (
                <button
                  type="button"
                  className="border border-line px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingDomainId(null);
                    setDomainName("");
                    setDomainKind("site");
                    setDomainDescription("");
                    setDomainSiteId("");
                  }}
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      {/* Load balancers */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-ink">{t("settings.inventory.loadBalancers")}</h4>
        <p className="text-sm text-ink-muted">{t("settings.inventory.loadBalancersHint")}</p>
        {lbsQuery.isLoading ? <p className="text-sm text-ink-muted">{t("common.loading")}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colName")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colIp")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colSite")}</th>
                <th className="py-2 pr-3 font-medium">{t("settings.inventory.colDescription")}</th>
                {isAdmin ? <th className="py-2 font-medium">{t("common.actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {lbs.map((lb) => (
                <tr key={lb.id} className="border-b border-line/60">
                  <td className="py-2 pr-3 text-ink">
                    <span className="font-mono">{lb.name}</span>
                    {lb.is_local ? (
                      <span className="ml-2 border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] text-accent uppercase">
                        {t("settings.inventory.thisLb")}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-ink-muted">{lb.ip_address || "—"}</td>
                  <td className="py-2 pr-3 text-ink-muted">{siteNameById(lb.site_id)}</td>
                  <td className="py-2 pr-3 text-ink-muted">{lb.description || "—"}</td>
                  {isAdmin ? (
                    <td className="py-2 space-x-2">
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => startEditLb(lb)}
                      >
                        {t("common.edit")}
                      </button>
                      {!lb.is_local ? (
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => {
                            if (!window.confirm(t("settings.inventory.confirmDeleteLb"))) return;
                            void mutations.deleteLoadBalancer.mutateAsync(lb.id);
                          }}
                        >
                          {t("common.delete")}
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin ? (
          <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => void submitLb(e)}>
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              placeholder={t("settings.inventory.lbNamePlaceholder")}
              value={lbName}
              onChange={(e) => setLbName(e.target.value)}
              required
            />
            <input
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              placeholder={t("settings.inventory.ipPlaceholder")}
              value={lbIp}
              onChange={(e) => setLbIp(e.target.value)}
            />
            <select
              className="border border-line bg-paper px-3 py-2 text-sm"
              value={lbSiteId}
              onChange={(e) => setLbSiteId(e.target.value)}
            >
              <option value="">{t("settings.inventory.noSite")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              className="border border-line bg-paper px-3 py-2 text-sm"
              placeholder={t("settings.inventory.descriptionPlaceholder")}
              value={lbDescription}
              onChange={(e) => setLbDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="border border-accent bg-accent px-3 py-2 text-sm text-white">
                {editingLbId ? t("common.save") : t("settings.inventory.addLb")}
              </button>
              {editingLbId ? (
                <button
                  type="button"
                  className="border border-line px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingLbId(null);
                    setLbName("");
                    setLbDescription("");
                    setLbIp("");
                    setLbSiteId("");
                  }}
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
        {mutations.createLoadBalancer.isError ||
        mutations.updateLoadBalancer.isError ||
        mutations.deleteLoadBalancer.isError ? (
          <p className="text-sm text-danger">
            {err(
              mutations.createLoadBalancer.error ??
                mutations.updateLoadBalancer.error ??
                mutations.deleteLoadBalancer.error,
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}
