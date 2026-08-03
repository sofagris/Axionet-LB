export type ElkLayoutKind =
  | "traffic"
  | "process"
  | "tree"
  | "star"
  | "swimlanes"
  | "compact"
  | "selected";

export type DesignerLayoutPrefs = {
  preserveGroups: boolean;
  preservePinned: boolean;
  animate: boolean;
  fitView: boolean;
  snapToGrid: boolean;
};

const PREFS_KEY = "ax-lb:designer-layout-prefs";

export const DEFAULT_LAYOUT_PREFS: DesignerLayoutPrefs = {
  preserveGroups: true,
  preservePinned: true,
  animate: true,
  fitView: false,
  snapToGrid: false,
};

export const PLACEMENT_DOMAIN_SUGGESTIONS = [
  "Site A",
  "Site B",
  "Shared Services",
] as const;

export const UNASSIGNED_DOMAIN = "Unassigned";

export function readDesignerLayoutPrefs(): DesignerLayoutPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_LAYOUT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT_PREFS };
    const parsed = JSON.parse(raw) as Partial<DesignerLayoutPrefs>;
    return {
      preserveGroups: parsed.preserveGroups ?? DEFAULT_LAYOUT_PREFS.preserveGroups,
      preservePinned: parsed.preservePinned ?? DEFAULT_LAYOUT_PREFS.preservePinned,
      animate: parsed.animate ?? DEFAULT_LAYOUT_PREFS.animate,
      fitView: parsed.fitView ?? DEFAULT_LAYOUT_PREFS.fitView,
      snapToGrid: parsed.snapToGrid ?? DEFAULT_LAYOUT_PREFS.snapToGrid,
    };
  } catch {
    return { ...DEFAULT_LAYOUT_PREFS };
  }
}

export function writeDesignerLayoutPrefs(prefs: DesignerLayoutPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
