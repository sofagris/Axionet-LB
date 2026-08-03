import type { CSSProperties } from "react";
import type { DesignerNodeData } from "./types";

/** Default opacity when a fill color is chosen but opacity is unset. */
export const DEFAULT_FILL_OPACITY = 0.28;

/** Curated swatches for group/lane backgrounds (not theme defaults). */
export const FILL_COLOR_PRESETS = [
  "#64748b", // slate
  "#0f766e", // teal
  "#1d4ed8", // blue
  "#b45309", // amber
  "#b91c1c", // red
  "#047857", // emerald
  "#334155", // ink
] as const;

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeFillColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!HEX_RE.test(trimmed)) return undefined;
  return trimmed.toLowerCase();
}

export function clampFillOpacity(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_FILL_OPACITY;
  return Math.min(1, Math.max(0, value));
}

/** CSS background for group/lane body when fillColor is set. */
export function nodeFillBackground(data: Pick<DesignerNodeData, "fillColor" | "fillOpacity">): CSSProperties {
  const color = normalizeFillColor(data.fillColor);
  if (!color) return {};
  const opacity = clampFillOpacity(data.fillOpacity);
  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` };
}
