import { createContext, useContext } from "react";

/** Node id currently highlighted as palette drop target, or null. */
export const DesignerDropTargetContext = createContext<string | null>(null);

export function useDesignerDropTargetId(): string | null {
  return useContext(DesignerDropTargetContext);
}
