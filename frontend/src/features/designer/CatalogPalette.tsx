import { useMemo, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { CATALOG_ITEMS } from "../catalog/catalogData";
import { CatalogBrandIcon } from "../catalog/CatalogBrandIcon";
import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import {
  DESIGNER_DND_MIME,
  type PaletteDragPayload,
} from "./types";

type Props = {
  instances: Instance[];
  vips: Vip[];
};

function setDragData(event: DragEvent, payload: PaletteDragPayload) {
  event.dataTransfer.setData(DESIGNER_DND_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copy";
}

export function CatalogPalette({ instances, vips }: Props) {
  const { t } = useTranslation();

  const catalogItems = useMemo(
    () =>
      CATALOG_ITEMS.filter(
        (item) =>
          item.kind === "service" ||
          item.kind === "core-service" ||
          item.kind === "blueprint" ||
          Boolean(item.deployableServiceType),
      ),
    [],
  );

  const brandByServiceType = useMemo(() => {
    const map = new Map<string, (typeof CATALOG_ITEMS)[number]>();
    for (const item of CATALOG_ITEMS) {
      if (item.deployableServiceType) {
        map.set(item.deployableServiceType, item);
      }
    }
    return map;
  }, []);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-paper-elevated/40">
      <div className="border-b border-line px-3 py-2">
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          {t("designer.palette.title")}
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <section>
          <h3 className="mb-1.5 px-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
            {t("designer.palette.catalog")}
          </h3>
          <ul className="space-y-1">
            {catalogItems.map((item) => {
              const comingSoon =
                item.status === "planned" ||
                item.status === "concept" ||
                !item.deployableServiceType;
              const draggable = true;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    draggable={draggable}
                    onDragStart={(event) =>
                      setDragData(event, {
                        source: "catalog",
                        catalogId: item.id,
                        catalogSlug: item.slug,
                        label: item.name,
                        serviceType: item.deployableServiceType,
                        catalogStatus: item.status,
                        brand: item.brand,
                        comingSoon,
                      })
                    }
                    className={[
                      "flex w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left text-sm",
                      comingSoon
                        ? "cursor-grab opacity-55 hover:border-line"
                        : "cursor-grab hover:border-accent hover:bg-paper",
                    ].join(" ")}
                    title={
                      comingSoon
                        ? t("designer.palette.comingSoon")
                        : t("designer.palette.dragHint")
                    }
                  >
                    <CatalogBrandIcon brand={item.brand} name={item.name} itemId={item.id} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{item.name}</span>
                      <span className="block truncate font-mono text-[10px] text-ink-muted">
                        {comingSoon ? t("designer.palette.comingSoon") : item.deployableServiceType}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-1.5 px-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
            {t("designer.palette.instances")}
          </h3>
          {instances.length === 0 ? (
            <p className="px-1 text-xs text-ink-muted">{t("designer.palette.noInstances")}</p>
          ) : (
            <ul className="space-y-1">
              {instances.map((inst) => {
                const catalog = brandByServiceType.get(inst.service_type);
                return (
                  <li key={inst.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        setDragData(event, {
                          source: "instance",
                          serviceId: inst.id,
                          label: inst.name,
                          serviceType: inst.service_type,
                          catalogSlug: catalog?.slug,
                          brand: catalog?.brand,
                        })
                      }
                      className="flex w-full cursor-grab items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left text-sm hover:border-accent hover:bg-paper"
                    >
                      {catalog ? (
                        <CatalogBrandIcon
                          brand={catalog.brand}
                          name={catalog.name}
                          itemId={catalog.id}
                          size="sm"
                        />
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line font-mono text-[10px]">
                          IN
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{inst.name}</span>
                        <span className="block truncate font-mono text-[10px] text-ink-muted">
                          {inst.service_type} · {inst.actual_state}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 px-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
            {t("designer.palette.vips")}
          </h3>
          {vips.length === 0 ? (
            <p className="px-1 text-xs text-ink-muted">{t("designer.palette.noVips")}</p>
          ) : (
            <ul className="space-y-1">
              {vips.map((vip) => (
                <li key={vip.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      setDragData(event, {
                        source: "vip",
                        vipId: vip.id,
                        label: vip.name,
                        address: vip.address,
                      })
                    }
                    className="flex w-full cursor-grab items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left text-sm hover:border-accent hover:bg-paper"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line font-mono text-[10px] text-ink-muted">
                      VIP
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{vip.name}</span>
                      <span className="block truncate font-mono text-[10px] text-ink-muted">
                        {vip.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
