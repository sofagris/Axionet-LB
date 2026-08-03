const STORAGE_KEY = "ax-lb.designer.fullWidth";
export const DESIGNER_FULL_WIDTH_EVENT = "ax-lb:designer-full-width";

export function readDesignerFullWidth(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function writeDesignerFullWidth(fullWidth: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, fullWidth ? "true" : "false");
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(DESIGNER_FULL_WIDTH_EVENT, { detail: { fullWidth } }),
  );
}
