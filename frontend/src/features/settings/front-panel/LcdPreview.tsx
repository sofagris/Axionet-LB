import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const MAX_COLS = 16;

export function clampLcdLine(value: string, max = MAX_COLS): string {
  return value.slice(0, max);
}

export function clampBrightness(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

type Props = {
  line1: string;
  line2: string;
  brightness: number;
  backlight: boolean;
  onLine1Change: (value: string) => void;
  onLine2Change: (value: string) => void;
  onBrightnessChange: (value: number) => void;
  onBacklightChange: (value: boolean) => void;
  onPreview: () => void;
  onWrite: () => void;
  onClear: () => void;
  onTestBacklight: () => void;
  onIdentify: () => void;
  log: string[];
};

export function LcdPreview({
  line1,
  line2,
  brightness,
  backlight,
  onLine1Change,
  onLine2Change,
  onBrightnessChange,
  onBacklightChange,
  onPreview,
  onWrite,
  onClear,
  onTestBacklight,
  onIdentify,
  log,
}: Props) {
  const { t } = useTranslation();
  const opacity = useMemo(() => 0.35 + (brightness / 255) * 0.65, [brightness]);

  return (
    <div className="space-y-4">
      <div
        className="inline-block rounded border border-line bg-paper-elevated p-3 font-mono"
        style={{ opacity: backlight ? opacity : 0.25 }}
        aria-label={t("frontPanel.previewLabel")}
      >
        <div className="border border-line bg-ink px-2 py-1 text-ok">
          <div className="whitespace-pre tracking-wider">{(line1 || " ".repeat(MAX_COLS)).padEnd(MAX_COLS).slice(0, MAX_COLS)}</div>
          <div className="whitespace-pre tracking-wider">{(line2 || " ".repeat(MAX_COLS)).padEnd(MAX_COLS).slice(0, MAX_COLS)}</div>
        </div>
        <p className="mt-1 text-center text-[10px] text-ink-muted">16 × 2</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-ink-muted">
          {t("frontPanel.line1")}
          <input
            type="text"
            maxLength={MAX_COLS}
            value={line1}
            onChange={(event) => onLine1Change(clampLcdLine(event.target.value))}
            className="mt-1 w-full border border-line bg-paper-elevated px-2 py-1.5 font-mono text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          {t("frontPanel.line2")}
          <input
            type="text"
            maxLength={MAX_COLS}
            value={line2}
            onChange={(event) => onLine2Change(clampLcdLine(event.target.value))}
            className="mt-1 w-full border border-line bg-paper-elevated px-2 py-1.5 font-mono text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          {t("frontPanel.brightness")} ({brightness})
          <input
            type="range"
            min={0}
            max={255}
            value={brightness}
            onChange={(event) => onBrightnessChange(clampBrightness(Number(event.target.value)))}
            className="mt-2 w-full"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={backlight}
            onChange={(event) => onBacklightChange(event.target.checked)}
          />
          {t("frontPanel.backlight")}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <MockBtn label={t("frontPanel.preview")} onClick={onPreview} />
        <MockBtn label={t("frontPanel.write")} onClick={onWrite} />
        <MockBtn label={t("frontPanel.clear")} onClick={onClear} />
        <MockBtn label={t("frontPanel.testBacklight")} onClick={onTestBacklight} />
        <MockBtn label={t("frontPanel.identify")} onClick={onIdentify} />
      </div>

      {log.length > 0 ? (
        <ul className="max-h-28 overflow-y-auto border border-line bg-paper p-2 font-mono text-[10px] text-ink-muted">
          {log.map((entry, index) => (
            <li key={`${index}-${entry}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MockBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="border border-line px-3 py-1.5 text-sm text-ink hover:border-accent"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** Exported for tests without mounting full settings. */
export function useLcdPreviewState() {
  const [line1, setLine1] = useState("AX-LB-01");
  const [line2, setLine2] = useState("HAProxy Ready");
  const [brightness, setBrightness] = useState(180);
  const [backlight, setBacklight] = useState(true);
  return {
    line1,
    setLine1,
    line2,
    setLine2,
    brightness,
    setBrightness,
    backlight,
    setBacklight,
  };
}
