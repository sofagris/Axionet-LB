import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  providerName: string;
  connectionState: "disconnected" | "connected";
  onMockConnect: () => void;
};

export function ProviderConnectionPreview({
  providerName,
  connectionState,
  onMockConnect,
}: Props) {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [zones, setZones] = useState("");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setToken("");
    onMockConnect();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {connectionState === "connected"
          ? t("catalog.providerConnected", { name: providerName })
          : t("catalog.providerDisconnected", { name: providerName })}
      </p>
      <form onSubmit={onSubmit} className="space-y-3 border border-line bg-paper p-3">
        <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          {t("catalog.providerAuth")}
        </p>
        <label className="block text-xs text-ink-muted">
          {t("catalog.providerToken")}
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-1 w-full border border-line bg-paper-elevated px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          {t("catalog.providerAccountId")}
          <input
            type="text"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="mt-1 w-full border border-line bg-paper-elevated px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          {t("catalog.providerZones")}
          <input
            type="text"
            value={zones}
            onChange={(event) => setZones(event.target.value)}
            placeholder="example.com"
            className="mt-1 w-full border border-line bg-paper-elevated px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <p className="text-xs text-ink-muted">{t("catalog.providerNoStore")}</p>
        <button
          type="submit"
          className="border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {t("catalog.actions.connectProvider")}
        </button>
      </form>
    </div>
  );
}
