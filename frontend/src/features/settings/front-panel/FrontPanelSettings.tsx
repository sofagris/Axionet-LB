import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { LcdCommandReference } from "./LcdCommandReference";
import { LcdConnectionCard } from "./LcdConnectionCard";
import { LcdKeypadTestDialog } from "./LcdKeypadTestDialog";
import { clampBrightness, clampLcdLine, LcdPreview } from "./LcdPreview";

export function FrontPanelSettings() {
  const { t } = useTranslation();
  const [line1, setLine1] = useState("AX-LB-01");
  const [line2, setLine2] = useState("HAProxy Ready");
  const [brightness, setBrightness] = useState(180);
  const [backlight, setBacklight] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [keyTestOpen, setKeyTestOpen] = useState(false);
  const [eepromResult, setEepromResult] = useState<string | null>(null);

  const pushLog = useCallback((message: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 12));
  }, []);

  return (
    <section id="front-panel" className="space-y-4 scroll-mt-20">
      <div>
        <h3 className="text-lg font-semibold text-ink">{t("frontPanel.title")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("frontPanel.subtitle")}</p>
        <p className="mt-1 font-mono text-[10px] tracking-wide text-warn uppercase">
          {t("frontPanel.mockupBadge")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LcdConnectionCard />
        <LcdCommandReference />
      </div>

      <div className="border border-line bg-paper-elevated p-4">
        <h4 className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          {t("frontPanel.display")}
        </h4>
        <div className="mt-3">
          <LcdPreview
            line1={line1}
            line2={line2}
            brightness={brightness}
            backlight={backlight}
            onLine1Change={setLine1}
            onLine2Change={setLine2}
            onBrightnessChange={(value) => setBrightness(clampBrightness(value))}
            onBacklightChange={setBacklight}
            onPreview={() => pushLog(t("frontPanel.logPreview"))}
            onWrite={() => pushLog(t("frontPanel.logWrite"))}
            onClear={() => {
              setLine1("");
              setLine2("");
              pushLog(t("frontPanel.logClear"));
            }}
            onTestBacklight={() => {
              setBacklight(true);
              pushLog(t("frontPanel.logBacklight"));
            }}
            onIdentify={() => pushLog(t("frontPanel.logIdentify"))}
            log={log}
          />
        </div>
      </div>

      <div className="border border-line bg-paper-elevated p-4">
        <h4 className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
          {t("frontPanel.keypad")}
        </h4>
        <p className="mt-2 text-sm text-ink-muted">{t("frontPanel.keypadHint")}</p>
        <button
          type="button"
          className="mt-3 border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
          onClick={() => setKeyTestOpen(true)}
        >
          {t("frontPanel.startKeyTest")}
        </button>
      </div>

      <div className="border border-warn/40 bg-paper-elevated p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-mono text-[10px] tracking-wide text-warn uppercase">
            {t("frontPanel.eepromTitle")}
          </h4>
          <span className="border border-warn px-1.5 py-0.5 font-mono text-[10px] text-warn uppercase">
            {t("frontPanel.experimental")}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">{t("frontPanel.eepromBody")}</p>
        <button
          type="button"
          className="mt-3 border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
          onClick={() => setEepromResult(t("frontPanel.eepromNotImplemented"))}
        >
          {t("frontPanel.readCapability")}
        </button>
        {eepromResult ? (
          <p className="mt-2 font-mono text-xs text-ink-muted">{eepromResult}</p>
        ) : null}
      </div>

      <LcdKeypadTestDialog open={keyTestOpen} onClose={() => setKeyTestOpen(false)} />
    </section>
  );
}

export { clampBrightness, clampLcdLine };
