import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { MutationGate } from "../../components/MutationGate";
import {
  useAppStoreSettingsMutations,
  useAppStoreSources,
  useAppStoreTrust,
} from "./appStoreHooks";

export function AppStoreSettings() {
  const { t } = useTranslation();
  const sourcesQuery = useAppStoreSources();
  const trustQuery = useAppStoreTrust();
  const mutations = useAppStoreSettingsMutations();

  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [storePriority, setStorePriority] = useState("0");
  const [keyName, setKeyName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onAddStore = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await mutations.createSource.mutateAsync({
        name: storeName.trim(),
        indexUrl: storeUrl.trim(),
        priority: Number(storePriority) || 0,
        enabled: true,
      });
      setStoreName("");
      setStoreUrl("");
      setStorePriority("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  const onAddKey = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await mutations.createKey.mutateAsync({
        name: keyName.trim(),
        publicKey: publicKey.trim(),
      });
      setKeyName("");
      setPublicKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  };

  const allowUnsigned = trustQuery.data?.allowUnsignedPackages ?? true;

  return (
    <div className="space-y-6">
      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <h3 className="font-semibold text-ink">{t("settings.appStores.sourcesTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("settings.appStores.sourcesHint")}</p>
        {sourcesQuery.isLoading ? (
          <p className="mt-3 text-sm text-ink-muted">{t("common.loading")}</p>
        ) : null}
        <ul className="mt-4 divide-y divide-line border border-line">
          {(sourcesQuery.data ?? []).map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {source.name}{" "}
                  <span className="font-mono text-[10px] text-ink-muted">
                    prio {source.priority}
                    {source.enabled ? "" : ` · ${t("settings.appStores.disabled")}`}
                  </span>
                </p>
                <p className="truncate font-mono text-xs text-ink-muted">{source.indexUrl}</p>
              </div>
              <MutationGate>
                <button
                  type="button"
                  className="text-sm text-danger hover:underline"
                  onClick={() => void mutations.deleteSource.mutateAsync(source.id)}
                >
                  {t("common.delete")}
                </button>
              </MutationGate>
            </li>
          ))}
          {(sourcesQuery.data ?? []).length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{t("settings.appStores.noSources")}</li>
          ) : null}
        </ul>
        <MutationGate>
          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_6rem_auto]" onSubmit={onAddStore}>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder={t("settings.appStores.namePlaceholder")}
              className="border border-line bg-paper px-3 py-2 text-sm"
              required
            />
            <input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://…/index.v1.json"
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              required
            />
            <input
              value={storePriority}
              onChange={(e) => setStorePriority(e.target.value)}
              type="number"
              className="border border-line bg-paper px-3 py-2 font-mono text-sm"
              title={t("settings.appStores.priority")}
            />
            <button type="submit" className="border border-line px-3 py-2 text-sm">
              {t("settings.appStores.addSource")}
            </button>
          </form>
        </MutationGate>
      </section>

      <section className="border border-line bg-paper-elevated p-5 shadow-sm">
        <h3 className="font-semibold text-ink">{t("settings.appStores.trustTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("settings.appStores.trustHint")}</p>
        <MutationGate>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={allowUnsigned}
              onChange={(e) => {
                void mutations.updateTrust.mutateAsync({
                  allowUnsignedPackages: e.target.checked,
                });
              }}
            />
            {t("settings.appStores.allowUnsigned")}
          </label>
        </MutationGate>

        <ul className="mt-4 divide-y divide-line border border-line">
          {(trustQuery.data?.keys ?? []).map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{key.name}</p>
                <p className="truncate font-mono text-xs text-ink-muted">{key.publicKey}</p>
              </div>
              <MutationGate>
                <button
                  type="button"
                  className="text-sm text-danger hover:underline"
                  onClick={() => void mutations.deleteKey.mutateAsync(key.id)}
                >
                  {t("common.delete")}
                </button>
              </MutationGate>
            </li>
          ))}
          {(trustQuery.data?.keys ?? []).length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{t("settings.appStores.noKeys")}</li>
          ) : null}
        </ul>

        <MutationGate>
          <form className="mt-4 space-y-3" onSubmit={onAddKey}>
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder={t("settings.appStores.keyNamePlaceholder")}
              className="w-full border border-line bg-paper px-3 py-2 text-sm"
              required
            />
            <textarea
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder={t("settings.appStores.publicKeyPlaceholder")}
              className="min-h-24 w-full border border-line bg-paper px-3 py-2 font-mono text-xs"
              required
            />
            <button type="submit" className="border border-line px-3 py-2 text-sm">
              {t("settings.appStores.addKey")}
            </button>
          </form>
        </MutationGate>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
