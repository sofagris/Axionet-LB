import type { ReactNode } from "react";
import { usePermissions } from "../features/auth/usePermissions";

type Props = {
  children: ReactNode;
  /** When true, hide children entirely for viewers instead of disabling. */
  hide?: boolean;
  className?: string;
};

/** Disables interactive descendants for viewers (fieldset), or hides them. */
export function MutationGate({ children, hide = false, className }: Props) {
  const { canMutate } = usePermissions();
  if (!canMutate && hide) return null;
  return (
    <fieldset
      disabled={!canMutate}
      className={["min-w-0 border-0 p-0 disabled:opacity-60", className].filter(Boolean).join(" ")}
    >
      {children}
    </fieldset>
  );
}
