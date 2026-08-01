import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listCustomers } from "../features/customers/customerData";
import { tenancyListTitleKey, useTenancy } from "../features/tenancy/TenancyProvider";

export function CustomersPage() {
  const { t } = useTranslation();
  const { mode, tenancyEnabled } = useTenancy();
  const customers = listCustomers();
  const titleKey = tenancyListTitleKey(mode);

  if (!tenancyEnabled) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("customers.title")}</h2>
        <p className="max-w-2xl text-ink-muted">{t("tenancy.disabledHint")}</p>
        <Link to="/settings?section=tenancy" className="inline-block text-sm text-accent hover:underline">
          {t("tenancy.openSettings")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{t(titleKey)}</h2>
          <span className="border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-warn uppercase">
            {t("customers.designPreview")}
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-ink-muted">
          {mode === "internal" ? t("customers.subtitleInternal") : t("customers.subtitle")}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t("customers.mockupHint")}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {customers.map((customer) => (
          <Link
            key={customer.id}
            to={`/customers/${customer.slug}`}
            className="border border-line bg-paper-elevated p-5 shadow-sm transition hover:border-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-ink">{customer.name}</h3>
                <p className="mt-0.5 font-mono text-[10px] text-ink-muted uppercase">
                  {customer.slug}
                </p>
              </div>
              <span className="font-mono text-[10px] tracking-wide text-ok uppercase">
                {t(`customers.status.${customer.status}`)}
              </span>
            </div>
            <p className="mt-3 text-sm text-ink-muted">{customer.summary}</p>
            <p className="mt-4 font-mono text-[10px] text-ink-muted uppercase">
              {t("customers.appCount", { count: customer.applications.length })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
