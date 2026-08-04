import type { CatalogBrand, CatalogStatus } from "../catalog/catalogTypes";
import {
  designerManifestByCatalogId,
  designerManifestByServiceType,
  designerServiceTrees,
  type DesignerComponentDef,
  type DesignerServiceTree,
} from "../catalog/designerManifests";

export type { DesignerComponentDef, DesignerServiceTree };

/** @deprecated Prefer DESIGNER_MANIFESTS — kept as derived view for existing callers. */
export const DESIGNER_SERVICE_TREES: DesignerServiceTree[] = designerServiceTrees();

export function serviceTreeByCatalogId(catalogId: string): DesignerServiceTree | undefined {
  const manifest = designerManifestByCatalogId(catalogId);
  if (!manifest) return undefined;
  return {
    catalogId: manifest.catalogId,
    serviceType: manifest.serviceType,
    components: manifest.components,
    chain: manifest.chain,
  };
}

export function serviceTreeByServiceType(serviceType: string): DesignerServiceTree | undefined {
  const manifest = designerManifestByServiceType(serviceType);
  if (!manifest) return undefined;
  return {
    catalogId: manifest.catalogId,
    serviceType: manifest.serviceType,
    components: manifest.components,
    chain: manifest.chain,
  };
}

export type CatalogDropMeta = {
  catalogId: string;
  catalogSlug: string;
  label: string;
  serviceType?: string;
  catalogStatus: CatalogStatus;
  brand: CatalogBrand;
  comingSoon: boolean;
};
