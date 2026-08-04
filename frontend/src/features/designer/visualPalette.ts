import type { VisualAnnotationId } from "./types";

export type VisualPaletteItem = {
  id: VisualAnnotationId;
  /** i18n key under designer.visuals.* */
  labelKey: string;
  descriptionKey: string;
};

/** Purely illustrative palette nodes — never reflected in runtime config. */
export const VISUAL_PALETTE_ITEMS: VisualPaletteItem[] = [
  {
    id: "internet-cloud",
    labelKey: "designer.visuals.internetCloud",
    descriptionKey: "designer.visuals.internetCloudHint",
  },
  {
    id: "user",
    labelKey: "designer.visuals.user",
    descriptionKey: "designer.visuals.userHint",
  },
  {
    id: "group",
    labelKey: "designer.visuals.group",
    descriptionKey: "designer.visuals.groupHint",
  },
  {
    id: "client",
    labelKey: "designer.visuals.client",
    descriptionKey: "designer.visuals.clientHint",
  },
];

export function visualPaletteItem(id: VisualAnnotationId): VisualPaletteItem | undefined {
  return VISUAL_PALETTE_ITEMS.find((item) => item.id === id);
}
