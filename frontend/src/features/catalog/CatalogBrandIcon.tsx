import { accentSoftBg, accentText } from "./catalogAccents";
import { catalogLogoSrc } from "./catalogLogos";
import type { CatalogBrand } from "./catalogTypes";

type Props = {
  brand: CatalogBrand;
  name: string;
  itemId?: string;
  size?: "sm" | "md";
};

export function CatalogBrandIcon({ brand, name, itemId, size = "md" }: Props) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const logo = itemId ? catalogLogoSrc(itemId) : undefined;

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line",
        dim,
        logo ? "bg-paper p-1" : `${accentSoftBg[brand.accent]} ${accentText[brand.accent]} font-mono font-semibold tracking-wide`,
      ].join(" ")}
    >
      {logo ? (
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" aria-hidden />
      ) : (
        <span aria-hidden title={name}>
          {brand.monogram}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
