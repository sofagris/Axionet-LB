import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCustomer } from "../features/customers/customerData";

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { customerId = "" } = useParams();
  const customer = getCustomer(customerId);

  if (!customer) {
    return (
      <div className="space-y-4">
        <p className="text-danger">{t("customers.notFound")}</p>
        <Link to="/customers" className="text-sm text-accent hover:underline">
          {t("customers.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          <Link to="/customers" className="hover:text-accent">
            {t("customers.title")}
          </Link>
          <span className="mx-2">/</span>
          {customer.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{customer.name}</h2>
          <span className="border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-warn uppercase">
            {t("customers.designPreview")}
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-ink-muted">{customer.summary}</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          {t("customers.applications")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {customer.applications.map((app) => (
            <Link
              key={app.id}
              to={`/customers/${customer.slug}/apps/${app.slug}`}
              className="border border-line bg-paper-elevated p-5 shadow-sm transition hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-base font-semibold text-ink">{app.name}</h4>
                <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                  {t(`customers.appStatus.${app.status}`)}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{app.summary}</p>
              {app.sites?.length ? (
                <p className="mt-3 font-mono text-[10px] text-ink-muted uppercase">
                  {t("customers.siteCount", { count: app.sites.length })}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-[10px] text-ink-muted uppercase">
                {t("customers.resourceCount", { count: app.resources.length })}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
