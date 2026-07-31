import { accentSoftBg, accentText } from "./catalogAccents";
import type { CatalogBrand } from "./catalogTypes";

type Props = {
  brand: CatalogBrand;
  name: string;
  size?: "sm" | "md";
};

export function CatalogBrandIcon({ brand, name, size = "md" }: Props) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <span
      aria-hidden
      title={name}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-md border border-line font-mono font-semibold tracking-wide",
        dim,
        accentSoftBg[brand.accent],
        accentText[brand.accent],
      ].join(" ")}
    >
      {brand.monogram}
    </span>
  );
}
