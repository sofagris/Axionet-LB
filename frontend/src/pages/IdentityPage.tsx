import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth/AuthProvider";
import { listCustomers } from "../features/customers/customerData";
import {
  useAppIdentityProviders,
  useAuthSources,
  useCreateAppIdentityProvider,
  useCreateAuthSource,
  useCreateUpnSuffix,
  useDeleteAppIdentityProvider,
  useDeleteAuthSource,
  useDeleteUpnSuffix,
  useUpnSuffixes,
} from "../features/identity/authSourceHooks";

type Tab = "sources" | "suffixes" | "appIdps";

function parseTab(value: string | null): Tab {
  if (value === "suffixes" || value === "appIdps" || value === "sources") return value;
  return "sources";
}

export function IdentityPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  if (loading) return <p className="text-ink-muted">{t("common.loading")}</p>;
  if (!user || user.effective_role !== "admin") return <Navigate to="/" replace />;

  function setTab(next: Tab) {
    setSearchParams(next === "sources" ? {} : { tab: next }, { replace: true });
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-line pb-6">
        <p className="font-mono text-[10px] tracking-[0.16em] text-domain-system uppercase">
          {t("identity.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{t("identity.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("identity.subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-line">
        {(
          [
            ["sources", t("identity.tabs.sources")],
            ["suffixes", t("identity.tabs.suffixes")],
            ["appIdps", t("identity.tabs.appIdps")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={[
              "px-3 py-2 text-sm",
              tab === id
                ? "border-b-2 border-domain-system font-medium text-ink"
                : "text-ink-muted",
            ].join(" ")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sources" ? <SourcesPanel /> : null}
      {tab === "suffixes" ? <SuffixesPanel /> : null}
      {tab === "appIdps" ? <AppIdpsPanel /> : null}
    </div>
  );
}

function SourcesPanel() {
  const { t } = useTranslation();
  const listQuery = useAuthSources();
  const createMutation = useCreateAuthSource();
  const deleteMutation = useDeleteAuthSource();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [description, setDescription] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        kind: "oidc",
        issuer_url: issuer.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret || undefined,
        description,
      });
      setShow(false);
      setName("");
      setIssuer("");
      setClientId("");
      setClientSecret("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          className="border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system"
          onClick={() => setShow(true)}
        >
          {t("identity.addOidcSource")}
        </button>
      </div>

      {show ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="w-full max-w-xl space-y-3 border border-line bg-paper p-5 shadow-lg"
          >
            <h2 className="text-lg font-semibold text-ink">{t("identity.createOidcSource")}</h2>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("identity.sourceName")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("identity.issuerUrl")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                required
                placeholder="https://login.microsoftonline.com/.../v2.0"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("identity.clientId")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("identity.clientSecret")}</span>
              <input
                type="password"
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">{t("identity.description")}</span>
              <textarea
                className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                className="border border-domain-system bg-domain-system-soft px-3 py-1.5 text-sm text-domain-system"
                disabled={createMutation.isPending}
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                className="border border-line px-3 py-1.5 text-sm text-ink-muted"
                onClick={() => setShow(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {listQuery.isLoading ? <p className="text-ink-muted">{t("common.loading")}</p> : null}
      <ul className="divide-y divide-line border border-line">
        {(listQuery.data ?? []).map((source) => (
          <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-ink">
                {source.name}{" "}
                <span className="font-mono text-xs text-ink-muted">({source.kind})</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {source.description || t("identity.noDescription")}
                {source.issuer_url ? ` · ${source.issuer_url}` : ""}
              </p>
            </div>
            {source.kind !== "local" ? (
              <button
                type="button"
                className="border border-danger/40 px-2.5 py-1 text-xs text-danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("identity.confirmDeleteSource", { name: source.name }))) {
                    void deleteMutation.mutateAsync(source.id).catch((err: unknown) => {
                      window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                    });
                  }
                }}
              >
                {t("common.delete")}
              </button>
            ) : (
              <span className="font-mono text-xs text-ink-muted">{t("identity.builtin")}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuffixesPanel() {
  const { t } = useTranslation();
  const suffixesQuery = useUpnSuffixes();
  const sourcesQuery = useAuthSources();
  const createMutation = useCreateUpnSuffix();
  const deleteMutation = useDeleteUpnSuffix();
  const [suffix, setSuffix] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const oidcSources = (sourcesQuery.data ?? []).filter((s) => s.kind === "oidc" && s.enabled);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        suffix: suffix.trim(),
        auth_source_id: sourceId,
      });
      setSuffix("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">{t("identity.suffixHelp")}</p>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="text-ink-muted">{t("identity.suffix")}</span>
          <input
            className="mt-1 block w-56 border border-line bg-paper px-3 py-2 font-mono text-sm"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="contoso.com"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("identity.source")}</span>
          <select
            className="mt-1 block w-56 border border-line bg-paper px-3 py-2 text-sm"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            required
          >
            <option value="">{t("identity.selectSource")}</option>
            {oidcSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system"
          disabled={createMutation.isPending || !sourceId}
        >
          {t("identity.bindSuffix")}
        </button>
      </form>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <ul className="divide-y divide-line border border-line">
        {(suffixesQuery.data ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-mono font-medium text-ink">@{row.suffix}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                → {row.auth_source_name} ({row.auth_source_kind})
              </p>
            </div>
            {row.suffix !== "internal" ? (
              <button
                type="button"
                className="border border-danger/40 px-2.5 py-1 text-xs text-danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  void deleteMutation.mutateAsync(row.id).catch((err: unknown) => {
                    window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                  });
                }}
              >
                {t("common.delete")}
              </button>
            ) : (
              <span className="font-mono text-xs text-ink-muted">{t("identity.reserved")}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppIdpsPanel() {
  const { t } = useTranslation();
  const listQuery = useAppIdentityProviders();
  const createMutation = useCreateAppIdentityProvider();
  const deleteMutation = useDeleteAppIdentityProvider();
  const customers = useMemo(() => listCustomers(), []);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        kind: "oidc",
        customer_id: customerId.trim() || null,
        config: { issuer_url: issuer.trim() },
      });
      setName("");
      setIssuer("");
      setCustomerId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">{t("identity.appIdpHelp")}</p>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="max-w-xl space-y-3 border border-line bg-paper-elevated/40 p-4"
      >
        <h2 className="text-sm font-semibold text-ink">{t("identity.addAppIdp")}</h2>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("identity.sourceName")}</span>
          <input
            className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("identity.issuerUrl")}</span>
          <input
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("identity.customerId")}</span>
          <select
            className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">{t("identity.customerNone")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.id})
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          className="border border-domain-system bg-domain-system-soft px-3 py-1.5 text-sm text-domain-system"
          disabled={createMutation.isPending}
        >
          {t("common.save")}
        </button>
      </form>

      <ul className="divide-y divide-line border border-line">
        {(listQuery.data ?? []).map((idp) => (
          <li key={idp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-ink">
                {idp.name}{" "}
                <span className="font-mono text-xs text-ink-muted">({idp.kind})</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {idp.customer_id
                  ? t("identity.customerBound", { id: idp.customer_id })
                  : t("identity.platformWide")}
              </p>
            </div>
            <button
              type="button"
              className="border border-danger/40 px-2.5 py-1 text-xs text-danger"
              disabled={deleteMutation.isPending}
              onClick={() => {
                void deleteMutation.mutateAsync(idp.id).catch((err: unknown) => {
                  window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                });
              }}
            >
              {t("common.delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
