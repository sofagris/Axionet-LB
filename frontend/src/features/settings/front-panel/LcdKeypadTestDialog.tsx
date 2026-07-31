import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const KEYS = [
  { label: "Enter", code: "E / 0x45" },
  { label: "Down", code: "F / 0x46" },
  { label: "Up", code: "G / 0x47" },
  { label: "Left", code: "I / 0x49" },
  { label: "Right", code: "J / 0x4A" },
];

const TEST_STEPS = ["Press LEFT", "Hold LEFT", "Press RIGHT", "Press UP", "Press DOWN", "Press ENTER"];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LcdKeypadTestDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setLog([]);
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const step = TEST_STEPS[stepIndex] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lcd-key-test-title"
    >
      <div className="w-full max-w-md space-y-4 border border-line bg-paper p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 id="lcd-key-test-title" className="text-lg font-semibold text-ink">
            {t("frontPanel.keyTestTitle")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="font-mono text-xs text-ink-muted uppercase hover:text-ink"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        <div>
          <p className="font-mono text-[10px] text-ink-muted uppercase">{t("frontPanel.keyMapping")}</p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-ink">
            {KEYS.map((key) => (
              <li key={key.label}>
                {key.label}: {key.code}
              </li>
            ))}
          </ul>
        </div>

        {step ? (
          <p className="border border-line bg-paper-elevated p-3 text-sm text-ink">
            {t("frontPanel.keyTestPrompt")}: <strong>{step}</strong>
          </p>
        ) : (
          <p className="text-sm text-ok">{t("frontPanel.keyTestDone")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!step}
            onClick={() => {
              if (!step) return;
              setLog((prev) => [...prev, `OK: ${step}`]);
              setStepIndex((prev) => prev + 1);
            }}
          >
            {t("frontPanel.keyTestSimulate")}
          </button>
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm text-ink-muted"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        {log.length > 0 ? (
          <ul className="max-h-28 overflow-y-auto border border-line bg-paper p-2 font-mono text-[10px] text-ink-muted">
            {log.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
