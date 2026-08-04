import type { PaletteDragPayload } from "./types";

let active: PaletteDragPayload | null = null;

/** Set on palette dragStart; cleared on dragEnd / drop. */
export function setActivePaletteDrag(payload: PaletteDragPayload | null): void {
  active = payload;
}

export function getActivePaletteDrag(): PaletteDragPayload | null {
  return active;
}
