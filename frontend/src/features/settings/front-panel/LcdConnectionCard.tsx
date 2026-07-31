import { useTranslation } from "react-i18next";

export function LcdConnectionCard() {
  const { t } = useTranslation();
  const rows: [string, string][] = [
    [t("frontPanel.device"), "/dev/ttyUSB0"],
    [t("frontPanel.detected"), "FTDI FT232R"],
    [t("frontPanel.baud"), "19200"],
    [t("frontPanel.format"), "8N1"],
    [t("frontPanel.geometry"), "16 × 2"],
    [t("frontPanel.status"), t("frontPanel.connected")],
  ];

  return (
    <div className="border border-line bg-paper-elevated p-4">
      <h4 className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
        {t("frontPanel.connection")}
      </h4>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="font-mono text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
