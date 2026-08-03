import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import { componentPropFields } from "./componentProps";
import {
  createWizardPath,
  instanceDetailPath,
  type DesignerEdge,
  type DesignerNode,
} from "./types";

type Props = {
  selectedNode: DesignerNode | null;
  selectedEdge: DesignerEdge | null;
  instances: Instance[];
  vips: Vip[];
  onUpdateNode: (nodeId: string, patch: Partial<DesignerNode["data"]>) => void;
  onUpdateEdge: (edgeId: string, patch: Partial<DesignerEdge["data"]> & { label?: string }) => void;
  onDeleteSelection: () => void;
};

export function DesignerPropertiesPanel({
  selectedNode,
  selectedEdge,
  instances,
  vips,
  onUpdateNode,
  onUpdateEdge,
  onDeleteSelection,
}: Props) {
  const { t } = useTranslation();

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-l border-line bg-paper-elevated/40">
        <div className="border-b border-line px-3 py-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
            {t("designer.properties.title")}
          </p>
        </div>
        <p className="px-3 py-4 text-sm text-ink-muted">{t("designer.properties.empty")}</p>
      </aside>
    );
  }

  if (selectedEdge) {
    const data = selectedEdge.data ?? {};
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-l border-line bg-paper-elevated/40">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
            {t("designer.properties.edge")}
          </p>
          <button
            type="button"
            className="text-xs text-danger hover:underline"
            onClick={onDeleteSelection}
          >
            {t("designer.properties.delete")}
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-3 py-3 text-sm">
          <label className="block">
            <span className="text-ink-muted">{t("designer.properties.protocol")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-2 py-1.5 text-ink"
              value={data.protocol ?? ""}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  protocol: e.target.value,
                  label: e.target.value || undefined,
                })
              }
              placeholder="HTTP / TCP"
            />
          </label>
          <label className="block">
            <span className="text-ink-muted">{t("designer.properties.note")}</span>
            <textarea
              className="mt-1 w-full border border-line bg-paper px-2 py-1.5 text-ink"
              rows={3}
              value={data.note ?? ""}
              onChange={(e) => onUpdateEdge(selectedEdge.id, { note: e.target.value })}
            />
          </label>
        </div>
      </aside>
    );
  }

  const node = selectedNode!;
  const data = node.data;
  const matchingInstances = instances.filter(
    (i) => !data.serviceType || i.service_type === data.serviceType,
  );
  const roleFields =
    data.kind === "catalog.component" && data.componentRole
      ? componentPropFields(data.componentRole)
      : [];

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-line bg-paper-elevated/40">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          {t("designer.properties.node")}
        </p>
        <button
          type="button"
          className="text-xs text-danger hover:underline"
          onClick={onDeleteSelection}
        >
          {t("designer.properties.delete")}
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto px-3 py-3 text-sm">
        <div>
          <p className="text-ink-muted">{t("designer.properties.label")}</p>
          <input
            className="mt-1 w-full border border-line bg-paper px-2 py-1.5 text-ink"
            value={data.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
          />
        </div>
        <div>
          <p className="text-ink-muted">{t("designer.properties.kind")}</p>
          <p className="mt-1 font-mono text-xs text-ink">{data.kind}</p>
        </div>
        {data.serviceType ? (
          <div>
            <p className="text-ink-muted">{t("designer.properties.serviceType")}</p>
            <p className="mt-1 font-mono text-xs text-ink">{data.serviceType}</p>
          </div>
        ) : null}
        {data.kind === "catalog.component" ? (
          <div>
            <p className="text-ink-muted">{t("designer.properties.componentRole")}</p>
            <p className="mt-1 font-mono text-xs text-ink">
              {data.componentRole ?? data.componentId ?? "—"}
            </p>
          </div>
        ) : null}
        {data.comingSoon ? (
          <p className="rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-xs text-warn">
            {t("designer.properties.comingSoonHint")}
          </p>
        ) : null}

        {(data.kind === "catalog.service" ||
          data.kind === "instance.ref" ||
          data.kind === "catalog.component" ||
          data.kind === "group.frame") &&
        !data.comingSoon ? (
          <label className="block">
            <span className="text-ink-muted">{t("designer.properties.linkInstance")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-2 py-1.5 text-ink"
              value={data.serviceId ?? ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                const inst = instances.find((i) => i.id === id);
                if (data.kind === "catalog.component" || data.kind === "group.frame") {
                  onUpdateNode(node.id, {
                    serviceId: id,
                    serviceType: inst?.service_type ?? data.serviceType,
                    label:
                      data.kind === "group.frame" && inst
                        ? inst.name
                        : data.label,
                  });
                  return;
                }
                onUpdateNode(node.id, {
                  serviceId: id,
                  kind: id ? "instance.ref" : "catalog.service",
                  label: inst?.name ?? data.label,
                  serviceType: inst?.service_type ?? data.serviceType,
                });
              }}
            >
              <option value="">{t("designer.properties.noInstance")}</option>
              {matchingInstances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.actual_state})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {data.kind === "vip.ref" ? (
          <label className="block">
            <span className="text-ink-muted">{t("designer.properties.linkVip")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-2 py-1.5 text-ink"
              value={data.vipId ?? ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                const vip = vips.find((v) => v.id === id);
                onUpdateNode(node.id, {
                  vipId: id,
                  label: vip?.name ?? data.label,
                });
              }}
            >
              <option value="">{t("designer.properties.noVip")}</option>
              {vips.map((vip) => (
                <option key={vip.id} value={vip.id}>
                  {vip.name} · {vip.address}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {roleFields.length > 0 ? (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              {t("designer.properties.componentProps")}
            </p>
            {roleFields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-ink-muted">{t(field.labelKey)}</span>
                <input
                  className="mt-1 w-full border border-line bg-paper px-2 py-1.5 font-mono text-xs text-ink"
                  value={data.props?.[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    onUpdateNode(node.id, {
                      props: {
                        ...(data.props ?? {}),
                        [field.key]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        ) : null}

        <label className="block">
          <span className="text-ink-muted">{t("designer.properties.note")}</span>
          <textarea
            className="mt-1 w-full border border-line bg-paper px-2 py-1.5 text-ink"
            rows={3}
            value={data.note ?? ""}
            onChange={(e) => onUpdateNode(node.id, { note: e.target.value })}
          />
        </label>

        <div className="space-y-1.5 border-t border-line pt-3">
          {(data.kind === "catalog.service" || data.kind === "group.frame") &&
          data.serviceType &&
          !data.serviceId &&
          !data.comingSoon ? (
            <Link
              to={createWizardPath(data.serviceType)}
              className="block border border-accent bg-accent px-2 py-1.5 text-center text-xs font-medium text-white"
            >
              {t("designer.properties.createInstance")}
            </Link>
          ) : null}
          {data.serviceId && data.serviceType ? (
            <Link
              to={instanceDetailPath(data.serviceType, data.serviceId)}
              className="block border border-line px-2 py-1.5 text-center text-xs text-ink hover:border-accent"
            >
              {t("designer.properties.openInstance")}
            </Link>
          ) : null}
          {data.kind === "vip.ref" ? (
            <Link
              to="/vips"
              className="block border border-line px-2 py-1.5 text-center text-xs text-ink hover:border-accent"
            >
              {t("designer.properties.openVips")}
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
