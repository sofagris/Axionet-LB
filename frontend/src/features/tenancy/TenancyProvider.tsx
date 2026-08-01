import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TenancyMode = "off" | "internal" | "customers";

export const TENANCY_MODES: TenancyMode[] = ["off", "internal", "customers"];

type TenancyContextValue = {
  mode: TenancyMode;
  setMode: (mode: TenancyMode) => void;
  /** Nav / list visible when not off */
  tenancyEnabled: boolean;
};

const STORAGE_KEY = "axionet-tenancy-mode";
const TenancyContext = createContext<TenancyContextValue | null>(null);

export function parseTenancyMode(value: string | null | undefined): TenancyMode | null {
  if (value === "off" || value === "internal" || value === "customers") return value;
  return null;
}

function resolveInitialMode(): TenancyMode {
  if (typeof window === "undefined") return "customers";
  return parseTenancyMode(window.localStorage.getItem(STORAGE_KEY)) ?? "customers";
}

export function TenancyProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TenancyMode>(() => resolveInitialMode());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((next: TenancyMode) => {
    setModeState(next);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      tenancyEnabled: mode !== "off",
    }),
    [mode, setMode],
  );

  return <TenancyContext.Provider value={value}>{children}</TenancyContext.Provider>;
}

export function useTenancy(): TenancyContextValue {
  const ctx = useContext(TenancyContext);
  if (!ctx) {
    throw new Error("useTenancy must be used within TenancyProvider");
  }
  return ctx;
}

/** Nav label key for current mode (null when tenancy off). */
export function tenancyNavLabelKey(mode: TenancyMode): string | null {
  if (mode === "off") return null;
  if (mode === "internal") return "nav.serviceAreas";
  return "nav.customers";
}

/** Page title key for customers list/detail. */
export function tenancyListTitleKey(mode: TenancyMode): string {
  if (mode === "internal") return "customers.titleInternal";
  return "customers.title";
}
