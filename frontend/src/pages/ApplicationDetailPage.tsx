import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppIdpBindingSection } from "../features/customers/AppIdpBindingSection";
import { getApplication } from "../features/customers/customerData";
import type { AppResourceKind } from "../features/customers/customerTypes";

const kindLabelKey: Record<AppResourceKind, string> = {
  vip: "customers.resourceKinds.vip",
  instance: "customers.resourceKinds.instance",
  certificate: "customers.resourceKinds.certificate",
  dns: "customers.resourceKinds.dns",
  pool: "customers.resourceKinds.pool",
  note: "customers.resourceKinds.note",
};

export function ApplicationDetailPage() {
  const { t } = useTranslation();
  const { customerId = "", appId = "" } = useParams();
  const resolved = getApplication(customerId, appId);

  if (!resolved) {
    return (
      <div className="space-y-4">
        <p className="text-danger">{t("customers.appNotFound")}</p>
        <Link to="/customers" className="text-sm text-accent hover:underline">
          {t("customers.backToList")}
        </Link>
      </div>
    );
  }

  const { customer, application } = resolved;

  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          <Link to="/customers" className="hover:text-accent">
            {t("customers.title")}
          </Link>
          <span className="mx-2">/</span>
          <Link to={`/customers/${customer.slug}`} className="hover:text-accent">
            {customer.name}
          </Link>
          <span className="mx-2">/</span>
          {application.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{application.name}</h2>
          <span className="border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-warn uppercase">
            {t("customers.designPreview")}
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-ink-muted">{application.summary}</p>

        {application.catalogItemSlug ? (
          <p className="mt-3 text-sm text-ink-muted">
            {t("customers.catalogLinkHint")}{" "}
            <Link
              to={`/catalog?item=${encodeURIComponent(application.catalogItemSlug)}`}
              className="text-accent hover:underline"
            >
              {application.catalogItemSlug}
            </Link>
            {application.catalogKindHint
              ? ` (${t(`customers.catalogKind.${application.catalogKindHint}`)})`
              : null}
          </p>
        ) : null}
      </section>

      {application.sites?.length ? (
        <section className="space-y-3">
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
            {t("customers.sites")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {application.sites.map((site) => (
              <div key={site.id} className="border border-line bg-paper-elevated p-4">
                <p className="font-semibold text-ink">{site.name}</p>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  {site.location} · {site.role}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <AppIdpBindingSection customerId={customer.id} applicationId={application.id} />

      <section className="space-y-3">
        <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          {t("customers.resources")}
        </h3>
        <ul className="divide-y divide-line border border-line bg-paper-elevated">
          {application.resources.map((resource) => (
            <li key={resource.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                    {t(kindLabelKey[resource.kind])}
                  </span>
                  {resource.site ? (
                    <span className="font-mono text-[10px] text-ink-muted">{resource.site}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 font-semibold text-ink">{resource.name}</p>
                <p className="mt-1 text-sm text-ink-muted">{resource.detail}</p>
              </div>
              {resource.href ? (
                <Link to={resource.href} className="shrink-0 text-sm text-accent hover:underline">
                  {t("customers.openRelated")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {application.notes?.length ? (
        <section className="space-y-2">
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
            {t("customers.notes")}
          </h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
            {application.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-ink-muted">{t("customers.noMutations")}</p>
    </div>
  );
}
