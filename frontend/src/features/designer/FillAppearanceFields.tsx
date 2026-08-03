import { useTranslation } from "react-i18next";
import {
  DEFAULT_FILL_OPACITY,
  FILL_COLOR_PRESETS,
  clampFillOpacity,
  normalizeFillColor,
} from "./nodeAppearance";
import type { DesignerNodeData } from "./types";

type Props = {
  data: DesignerNodeData;
  onChange: (patch: Partial<DesignerNodeData>) => void;
};

export function FillAppearanceFields({ data, onChange }: Props) {
  const { t } = useTranslation();
  const color = normalizeFillColor(data.fillColor) ?? "";
  const opacityPct = Math.round(clampFillOpacity(data.fillOpacity) * 100);
  const hasFill = Boolean(color);

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
        {t("designer.properties.fillAppearance")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {FILL_COLOR_PRESETS.map((preset) => {
          const active = color === preset;
          return (
            <button
              key={preset}
              type="button"
              title={preset}
              aria-label={preset}
              aria-pressed={active}
              className={[
                "h-6 w-6 rounded-sm border",
                active ? "border-accent ring-1 ring-accent" : "border-line",
              ].join(" ")}
              style={{ backgroundColor: preset }}
              onClick={() =>
                onChange({
                  fillColor: preset,
                  fillOpacity: data.fillOpacity ?? DEFAULT_FILL_OPACITY,
                })
              }
            />
          );
        })}
      </div>
      <label className="flex items-center gap-2">
        <span className="text-ink-muted">{t("designer.properties.fillColor")}</span>
        <input
          type="color"
          className="h-8 w-10 cursor-pointer border border-line bg-paper p-0.5"
          value={color || "#64748b"}
          onChange={(e) =>
            onChange({
              fillColor: e.target.value,
              fillOpacity: data.fillOpacity ?? DEFAULT_FILL_OPACITY,
            })
          }
        />
        <input
          type="text"
          className="min-w-0 flex-1 border border-line bg-paper px-2 py-1 font-mono text-xs text-ink"
          value={color}
          placeholder="#64748b"
          onChange={(e) => {
            const next = e.target.value.trim();
            if (!next) {
              onChange({ fillColor: undefined, fillOpacity: undefined });
              return;
            }
            const normalized = normalizeFillColor(next.startsWith("#") ? next : `#${next}`);
            if (normalized) {
              onChange({
                fillColor: normalized,
                fillOpacity: data.fillOpacity ?? DEFAULT_FILL_OPACITY,
              });
            }
          }}
        />
      </label>
      <label className="block">
        <span className="flex items-center justify-between text-ink-muted">
          <span>{t("designer.properties.fillOpacity")}</span>
          <span className="font-mono text-xs text-ink">{opacityPct}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={!hasFill}
          className="mt-1 w-full accent-accent disabled:opacity-40"
          value={hasFill ? opacityPct : Math.round(DEFAULT_FILL_OPACITY * 100)}
          onChange={(e) =>
            onChange({
              fillOpacity: Number(e.target.value) / 100,
              fillColor: data.fillColor ?? FILL_COLOR_PRESETS[0],
            })
          }
        />
      </label>
      {hasFill ? (
        <button
          type="button"
          className="text-xs text-ink-muted hover:text-ink hover:underline"
          onClick={() => onChange({ fillColor: undefined, fillOpacity: undefined })}
        >
          {t("designer.properties.fillClear")}
        </button>
      ) : null}
    </div>
  );
}
