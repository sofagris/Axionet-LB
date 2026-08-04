import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MutationGate } from "../../components/MutationGate";
import type { AppStorePackage } from "../../api/appPackages";
import { useAppStore, useInstallAppPackage } from "./hooks";

type Props = {
  onOpenDetails: (slug: string) => void;
};

export function CatalogAppStore({ onOpenDetails }: Props) {
  const { t } = useTranslation();
  const storeQuery = useAppStore();
  const installMutation = useInstallAppPackage();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packages = storeQuery.data?.packages ?? [];

  const onInstall = async (pkg: AppStorePackage) => {
    setMessage(null);
    setError(null);
    try {
      const result = await installMutation.mutateAsync({ packageId: pkg.id });
      setMessage(
        result.status === "already_installed"
          ? t("catalog.appStore.alreadyInstalled", { name: pkg.name })
          : t("catalog.appStore.installed", { name: pkg.name, version: result.version }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          {t("catalog.appStore.title")}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">{t("catalog.appStore.hint")}</p>
        {storeQuery.data ? (
          <p className="mt-1 font-mono text-[10px] text-ink-muted">
            {storeQuery.data.indexSource === "remote"
              ? t("catalog.appStore.indexRemote", {
                  url: storeQuery.data.indexUrl ?? "",
                })
              : t("catalog.appStore.indexBundled")}
          </p>
        ) : null}
      </div>

      {storeQuery.isError ? (
        <p className="text-sm text-danger">
          {t("catalog.appStore.loadFailed", {
            message:
              storeQuery.error instanceof Error
                ? storeQuery.error.message
                : t("common.unknownError"),
          })}
        </p>
      ) : null}

      {message ? <p className="text-sm text-ink">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {packages.length === 0 && !storeQuery.isLoading ? (
        <p className="text-sm text-ink-muted">{t("catalog.appStore.empty")}</p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-paper-elevated">
          {packages.map((pkg) => (
            <li
              key={pkg.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <button
                    type="button"
                    className="truncate text-sm font-semibold text-ink hover:text-accent"
                    onClick={() => onOpenDetails(pkg.id)}
                  >
                    {pkg.name}
                  </button>
                  <span className="font-mono text-[10px] text-ink-muted">v{pkg.version}</span>
                  <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                    {pkg.installed
                      ? t("catalog.appStore.statusInstalled")
                      : t("catalog.appStore.statusAvailable")}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{pkg.summary}</p>
              </div>
              <MutationGate>
                <button
                  type="button"
                  disabled={pkg.installed || installMutation.isPending}
                  onClick={() => void onInstall(pkg)}
                  className="shrink-0 border border-line px-2.5 py-1 font-mono text-[10px] tracking-wide text-ink uppercase hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pkg.installed
                    ? t("catalog.appStore.installedLabel")
                    : t("catalog.appStore.install")}
                </button>
              </MutationGate>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
