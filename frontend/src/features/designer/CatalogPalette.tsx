import { useMemo, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { CATALOG_ITEMS } from "../catalog/catalogData";
import { CatalogBrandIcon } from "../catalog/CatalogBrandIcon";
import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import {
  serviceTreeByCatalogId,
  serviceTreeByServiceType,
} from "./paletteComponents";
import {
  DESIGNER_DND_MIME,
  type PaletteDragPayload,
} from "./types";
import { setActivePaletteDrag } from "./paletteDrag";

type Props = {
  instances: Instance[];
  vips: Vip[];
};

function setDragData(event: DragEvent, payload: PaletteDragPayload) {
  setActivePaletteDrag(payload);
  event.dataTransfer.setData(DESIGNER_DND_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copy";
}

function clearDragData() {
  setActivePaletteDrag(null);
}

export function CatalogPalette({ instances, vips }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    haproxy: true,
  });

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

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
              const tree = serviceTreeByCatalogId(item.id);
              const isOpen = Boolean(expanded[item.id]);
              return (
                <li key={item.id}>
                  <div className="flex items-stretch gap-0.5">
                    {tree ? (
                      <button
                        type="button"
                        className="shrink-0 px-0.5 font-mono text-[10px] text-ink-muted hover:text-ink"
                        aria-expanded={isOpen}
                        aria-label={t("designer.palette.toggleComponents")}
                        onClick={() => toggle(item.id)}
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="inline-block w-3 shrink-0" />
                    )}
                    <button
                      type="button"
                      draggable
                      onDragEnd={clearDragData}
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
                          dropMode: tree ? "tree" : "single",
                        })
                      }
                      className={[
                        "flex min-w-0 flex-1 items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left text-sm",
                        comingSoon
                          ? "cursor-grab opacity-55 hover:border-line"
                          : "cursor-grab hover:border-accent hover:bg-paper",
                      ].join(" ")}
                      title={
                        tree
                          ? t("designer.palette.dragTreeHint")
                          : comingSoon
                            ? t("designer.palette.comingSoon")
                            : t("designer.palette.dragHint")
                      }
                    >
                      <CatalogBrandIcon
                        brand={item.brand}
                        name={item.name}
                        itemId={item.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{item.name}</span>
                        <span className="block truncate font-mono text-[10px] text-ink-muted">
                          {comingSoon
                            ? t("designer.palette.comingSoon")
                            : tree
                              ? t("designer.palette.withComponents", {
                                  count: tree.components.length,
                                })
                              : item.deployableServiceType}
                        </span>
                      </span>
                    </button>
                  </div>
                  {tree && isOpen ? (
                    <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-line pl-2">
                      {tree.components.map((component) => (
                        <li key={component.id}>
                          <button
                            type="button"
                            draggable
                            onDragEnd={clearDragData}
                            onDragStart={(event) =>
                              setDragData(event, {
                                source: "catalog.component",
                                catalogId: item.id,
                                catalogSlug: item.slug,
                                label: component.label,
                                serviceType: item.deployableServiceType,
                                catalogStatus: item.status,
                                brand: item.brand,
                                comingSoon,
                                componentId: component.id,
                                componentRole: component.role,
                              })
                            }
                            className="flex w-full cursor-grab items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left text-xs hover:border-accent hover:bg-paper"
                            title={t("designer.palette.dragComponentHint")}
                          >
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line font-mono text-[9px] text-ink-muted uppercase">
                              {component.role.slice(0, 2)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-ink">{component.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
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
                const tree = serviceTreeByServiceType(inst.service_type);
                const expandKey = `inst:${inst.id}`;
                const isOpen = Boolean(expanded[expandKey]);
                return (
                  <li key={inst.id}>
                    <div className="flex items-stretch gap-0.5">
                      {tree ? (
                        <button
                          type="button"
                          className="shrink-0 px-0.5 font-mono text-[10px] text-ink-muted hover:text-ink"
                          aria-expanded={isOpen}
                          onClick={() => toggle(expandKey)}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="inline-block w-3 shrink-0" />
                      )}
                      <button
                        type="button"
                        draggable
                        onDragEnd={clearDragData}
                        onDragStart={(event) =>
                          setDragData(event, {
                            source: "instance",
                            serviceId: inst.id,
                            label: inst.name,
                            serviceType: inst.service_type,
                            catalogSlug: catalog?.slug,
                            brand: catalog?.brand,
                            dropMode: tree ? "tree" : "single",
                          })
                        }
                        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left text-sm hover:border-accent hover:bg-paper"
                        title={
                          tree
                            ? t("designer.palette.dragTreeHint")
                            : t("designer.palette.dragHint")
                        }
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
                    </div>
                    {tree && isOpen ? (
                      <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-line pl-2">
                        {tree.components.map((component) => (
                          <li key={component.id}>
                            <button
                              type="button"
                              draggable
                              onDragEnd={clearDragData}
                              onDragStart={(event) =>
                                setDragData(event, {
                                  source: "instance.component",
                                  serviceId: inst.id,
                                  label: component.label,
                                  serviceType: inst.service_type,
                                  catalogId: tree.catalogId,
                                  catalogSlug: catalog?.slug,
                                  brand: catalog?.brand,
                                  componentId: component.id,
                                  componentRole: component.role,
                                })
                              }
                              className="flex w-full cursor-grab items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left text-xs hover:border-accent hover:bg-paper"
                            >
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line font-mono text-[9px] text-ink-muted uppercase">
                                {component.role.slice(0, 2)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-ink">
                                {component.label}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
                    onDragEnd={clearDragData}
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
