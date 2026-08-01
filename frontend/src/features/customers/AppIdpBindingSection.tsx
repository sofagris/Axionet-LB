import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../auth/usePermissions";
import {
  useAppIdpBindings,
  useAppIdentityProviders,
  useCreateAppIdpBinding,
  useDeleteAppIdpBinding,
} from "../identity/authSourceHooks";

type Props = {
  customerId: string;
  applicationId: string;
};

export function AppIdpBindingSection({ customerId, applicationId }: Props) {
  const { t } = useTranslation();
  const { isAdmin } = usePermissions();
  const bindingsQuery = useAppIdpBindings({
    customer_id: customerId,
    application_id: applicationId,
  });
  const idpsQuery = useAppIdentityProviders(undefined, { enabled: isAdmin });
  const createMutation = useCreateAppIdpBinding();
  const deleteMutation = useDeleteAppIdpBinding();
  const [providerId, setProviderId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bindings = bindingsQuery.data ?? [];
  const eligibleIdps = useMemo(() => {
    const all = idpsQuery.data ?? [];
    return all.filter(
      (idp) =>
        idp.enabled &&
        (idp.customer_id == null || idp.customer_id === "" || idp.customer_id === customerId),
    );
  }, [idpsQuery.data, customerId]);

  async function onBind(event: FormEvent) {
    event.preventDefault();
    if (!providerId) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        app_identity_provider_id: providerId,
        customer_id: customerId,
        application_id: applicationId,
      });
      setProviderId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
            {t("customers.appIdp.title")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("customers.appIdp.help")}</p>
        </div>
        {isAdmin ? (
          <Link to="/identity?tab=appIdps" className="text-sm text-accent hover:underline">
            {t("customers.appIdp.manageIdps")}
          </Link>
        ) : null}
      </div>

      {bindingsQuery.isLoading ? (
        <p className="text-sm text-ink-muted">{t("common.loading")}</p>
      ) : null}
      {bindingsQuery.isError ? (
        <p className="text-sm text-danger">
          {bindingsQuery.error instanceof Error
            ? bindingsQuery.error.message
            : t("common.unknownError")}
        </p>
      ) : null}

      {bindings.length === 0 && !bindingsQuery.isLoading ? (
        <p className="border border-line bg-paper-elevated px-4 py-3 text-sm text-ink-muted">
          {t("customers.appIdp.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-paper-elevated">
          {bindings.map((binding) => (
            <li
              key={binding.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {binding.app_identity_provider_name}{" "}
                  <span className="font-mono text-xs text-ink-muted">
                    ({binding.app_identity_provider_kind})
                  </span>
                </p>
                {!binding.app_identity_provider_enabled ? (
                  <p className="mt-0.5 text-xs text-warn">{t("customers.appIdp.disabled")}</p>
                ) : null}
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  className="border border-danger/40 px-2.5 py-1 text-xs text-danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void deleteMutation.mutateAsync(binding.id).catch((err: unknown) => {
                      window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                    });
                  }}
                >
                  {t("customers.appIdp.unbind")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && bindings.length === 0 ? (
        <form
          onSubmit={(e) => void onBind(e)}
          className="flex flex-wrap items-end gap-3 border border-line bg-paper-elevated/40 p-4"
        >
          <label className="min-w-[14rem] flex-1 text-sm">
            <span className="text-ink-muted">{t("customers.appIdp.selectIdp")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              required
              disabled={idpsQuery.isLoading || idpsQuery.isError}
            >
              <option value="">{t("customers.appIdp.selectPlaceholder")}</option>
              {eligibleIdps.map((idp) => (
                <option key={idp.id} value={idp.id}>
                  {idp.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={createMutation.isPending || !providerId}
          >
            {t("customers.appIdp.bind")}
          </button>
          {error ? <p className="w-full text-sm text-danger">{error}</p> : null}
          {idpsQuery.isError ? (
            <p className="w-full text-sm text-danger">{t("customers.appIdp.loadIdpsFailed")}</p>
          ) : null}
          {!idpsQuery.isLoading && eligibleIdps.length === 0 ? (
            <p className="w-full text-sm text-ink-muted">{t("customers.appIdp.noEligible")}</p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
