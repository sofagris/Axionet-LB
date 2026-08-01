import { useTranslation } from "react-i18next";
import { TENANCY_MODES, useTenancy, type TenancyMode } from "../tenancy/TenancyProvider";

export function TenancySettings() {
  const { t } = useTranslation();
  const { mode, setMode } = useTenancy();

  return (
    <section id="tenancy" className="scroll-mt-20 space-y-4 border border-line bg-paper-elevated p-5 shadow-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-ink">{t("tenancy.title")}</h3>
          <span className="border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-warn uppercase">
            {t("tenancy.designPreview")}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{t("tenancy.subtitle")}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">{t("tenancy.title")}</legend>
        {TENANCY_MODES.map((option) => (
          <label
            key={option}
            className={[
              "flex cursor-pointer gap-3 border px-3 py-3",
              mode === option ? "border-accent bg-accent-soft/40" : "border-line hover:border-accent",
            ].join(" ")}
          >
            <input
              type="radio"
              name="tenancy-mode"
              className="mt-1"
              checked={mode === option}
              onChange={() => setMode(option)}
              value={option}
            />
            <span>
              <span className="block text-sm font-medium text-ink">{t(`tenancy.modes.${option}.label`)}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                {t(`tenancy.modes.${option}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="font-mono text-[10px] text-ink-muted uppercase">
        {t("tenancy.current", { mode: t(`tenancy.modes.${mode as TenancyMode}.label`) })}
      </p>
    </section>
  );
}
