import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useServiceDefinitions } from "../features/catalog/hooks";

export function CatalogPage() {
  const { t } = useTranslation();
  const catalogQuery = useServiceDefinitions();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">{t("catalog.title")}</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">{t("catalog.subtitle")}</p>
      </section>

      {catalogQuery.isLoading ? (
        <p className="text-ink-muted">{t("common.loading")}</p>
      ) : null}

      {catalogQuery.isError ? (
        <p className="text-sm text-danger">
          {t("catalog.loadFailed", {
            message:
              catalogQuery.error instanceof Error
                ? catalogQuery.error.message
                : t("common.unknownError"),
          })}
        </p>
      ) : null}

      {catalogQuery.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogQuery.data.map((service) => (
            <article
              key={service.service_type}
              className={`border border-line bg-paper-elevated p-5 shadow-sm ${
                service.enabled ? "" : "opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink">{service.display_name}</h3>
                <span
                  className={`font-mono text-[10px] tracking-wide uppercase ${
                    service.enabled ? "text-ok" : "text-ink-muted"
                  }`}
                >
                  {service.enabled ? t("catalog.available") : t("catalog.comingSoon")}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{service.description}</p>
              <p className="mt-3 font-mono text-xs text-ink-muted">
                {service.container_image}:{service.default_version}
              </p>
              <div className="mt-5">
                {service.enabled ? (
                  <Link
                    to={`/instances/new?type=${service.service_type}`}
                    className="inline-block border border-accent bg-accent px-4 py-2 text-sm font-medium text-white"
                  >
                    {t("catalog.create")}
                  </Link>
                ) : (
                  <span className="inline-block border border-line px-4 py-2 text-sm text-ink-muted">
                    {t("catalog.unavailable")}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
