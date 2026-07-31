import { useTranslation } from "react-i18next";

const COMMANDS = [
  { name: "Clear", bytes: "FE 58" },
  { name: "Cursor", bytes: "FE 47 <column> <row>" },
  { name: "Brightness", bytes: "FE 99 <value>" },
];

export function LcdCommandReference() {
  const { t } = useTranslation();
  return (
    <div className="border border-line bg-paper-elevated p-4">
      <h4 className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
        {t("frontPanel.knownCommands")}
      </h4>
      <p className="mt-2 text-sm text-ink-muted">{t("frontPanel.knownCommandsHint")}</p>
      <ul className="mt-3 space-y-1 font-mono text-xs text-ink">
        {COMMANDS.map((cmd) => (
          <li key={cmd.name}>
            {cmd.name}: {cmd.bytes}
          </li>
        ))}
      </ul>
    </div>
  );
}
