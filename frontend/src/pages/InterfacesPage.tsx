import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSystemInfo } from "../features/system/hooks";
import {
  useConfirmInterfaceChange,
  useInterfaces,
  usePromoteManagement,
  useRescanInterfaces,
  useUpdateInterface,
} from "../features/interfaces/hooks";
import type { PhysicalInterface } from "../types/interfaces";

function linkTone(state: string): string {
  if (state === "up") return "text-ok";
  if (state === "down") return "text-danger";
  return "text-ink-muted";
}

function formatSpeed(mbps: number | null): string {
  if (mbps == null) return "—";
  if (mbps >= 1000) return `${mbps / 1000} Gbps`;
  return `${mbps} Mbps`;
}

function needsDangerConfirm(iface: PhysicalInterface, draft: EditDraft): string[] {
  const reasons: string[] = [];
  if (draft.administrative_state === "disabled" && iface.administrative_state !== "disabled") {
    reasons.push("disable");
  }
  if (draft.mtu !== "" && Number(draft.mtu) !== iface.mtu) {
    const mtu = Number(draft.mtu);
    if (mtu < 1280) reasons.push("lowMtu");
    else if (iface.is_management) reasons.push("mgmtMtu");
  }
  if (draft.speedMode === "fixed" && draft.speedMbps !== "" && Number(draft.speedMbps) !== iface.speed_mbps) {
    reasons.push("speed");
  }
  if (draft.speedMode === "autoneg") {
    reasons.push("speed");
  }
  return reasons;
}

type EditDraft = {
  description: string;
  mtu: string;
  administrative_state: "enabled" | "disabled";
  exclusive_use: boolean;
  speedMode: "keep" | "autoneg" | "fixed";
  speedMbps: string;
};

function draftFrom(iface: PhysicalInterface): EditDraft {
  return {
    description: iface.description ?? "",
    mtu: iface.mtu != null ? String(iface.mtu) : "",
    administrative_state: iface.administrative_state,
    exclusive_use: iface.exclusive_use,
    speedMode: "keep",
    speedMbps: iface.speed_mbps != null ? String(iface.speed_mbps) : "1000",
  };
}

function InterfaceEditor({
  iface,
  onClose,
}: {
  iface: PhysicalInterface;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateInterface();
  const promote = usePromoteManagement();
  const confirmChange = useConfirmInterfaceChange();
  const [draft, setDraft] = useState<EditDraft>(() => draftFrom(iface));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rollbackAt, setRollbackAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoteHint, setPromoteHint] = useState<string | null>(null);

  const dangerReasons = useMemo(() => needsDangerConfirm(iface, draft), [iface, draft]);

  useEffect(() => {
    if (!rollbackAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(rollbackAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [rollbackAt]);

  async function save(withConfirm: boolean) {
    setError(null);
    if (dangerReasons.length && !withConfirm) {
      setError(t("interfaces.confirmRequired"));
      return;
    }
    if (iface.is_management && draft.administrative_state === "disabled") {
      setError(t("interfaces.cannotDisableMgmt"));
      return;
    }
    const payload: Record<string, unknown> = {
      description: draft.description || null,
      exclusive_use: draft.exclusive_use,
      administrative_state: draft.administrative_state,
      confirm: withConfirm || undefined,
    };
    if (draft.mtu !== "") {
      payload.mtu = Number(draft.mtu);
    }
    if (draft.speedMode === "autoneg") {
      payload.speed_autoneg = true;
    } else if (draft.speedMode === "fixed" && draft.speedMbps !== "") {
      payload.speed_mbps = Number(draft.speedMbps);
    }
    try {
      const result = await update.mutateAsync({
        id: iface.id,
        payload,
      });
      if (result.pending_change_id) {
        setPendingId(result.pending_change_id);
        setRollbackAt(result.rollback_at ?? null);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  async function onPromote() {
    setError(null);
    setPromoteHint(null);
    try {
      const result = await promote.mutateAsync(iface.id);
      setPromoteHint(
        t("interfaces.promoteDone", {
          ip: result.management_bind_ip,
          hint: result.compose_hint,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  async function onConfirmPending() {
    if (!pendingId) return;
    try {
      await confirmChange.mutateAsync(pendingId);
      setPendingId(null);
      setRollbackAt(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-ink-muted">{t("interfaces.description")}</span>
          <input
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("interfaces.mtu")}</span>
          <input
            type="number"
            min={68}
            max={9216}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
            value={draft.mtu}
            onChange={(e) => setDraft((d) => ({ ...d, mtu: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("interfaces.adminState")}</span>
          <select
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
            value={draft.administrative_state}
            disabled={iface.is_management}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                administrative_state: e.target.value as "enabled" | "disabled",
              }))
            }
          >
            <option value="enabled">{t("interfaces.enabled")}</option>
            <option value="disabled">{t("interfaces.disabled")}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">{t("interfaces.speed")}</span>
          <select
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
            value={draft.speedMode}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                speedMode: e.target.value as EditDraft["speedMode"],
              }))
            }
          >
            <option value="keep">{t("interfaces.speedKeep")}</option>
            <option value="autoneg">{t("interfaces.speedAutoneg")}</option>
            <option value="fixed">{t("interfaces.speedFixed")}</option>
          </select>
          {draft.speedMode === "fixed" ? (
            <input
              type="number"
              className="mt-2 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
              value={draft.speedMbps}
              onChange={(e) => setDraft((d) => ({ ...d, speedMbps: e.target.value }))}
            />
          ) : null}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={draft.exclusive_use}
            onChange={(e) => setDraft((d) => ({ ...d, exclusive_use: e.target.checked }))}
          />
          {t("interfaces.exclusiveUse")}
        </label>
      </div>

      {iface.is_management ? (
        <p className="mt-3 font-mono text-xs text-accent">{t("interfaces.mgmtLocked")}</p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {promoteHint ? <p className="mt-3 font-mono text-xs text-ok">{promoteHint}</p> : null}

      {pendingId ? (
        <div className="mt-4 border border-warn bg-paper-elevated p-3">
          <p className="text-sm text-ink">{t("interfaces.pendingConfirm", { seconds: secondsLeft ?? "—" })}</p>
          <button
            type="button"
            className="mt-2 border border-accent bg-accent px-3 py-1.5 text-sm text-white"
            onClick={() => void onConfirmPending()}
          >
            {t("interfaces.confirmReachable")}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-accent bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-60"
            disabled={update.isPending}
            onClick={() => void save(false)}
          >
            {t("interfaces.save")}
          </button>
          {dangerReasons.length ? (
            <button
              type="button"
              className="border border-warn px-3 py-1.5 text-sm text-warn disabled:opacity-60"
              disabled={update.isPending}
              onClick={() => void save(true)}
            >
              {t("interfaces.saveConfirm")}
            </button>
          ) : null}
          {!iface.is_management ? (
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-60"
              disabled={promote.isPending}
              onClick={() => void onPromote()}
            >
              {t("interfaces.promote")}
            </button>
          ) : null}
          <button type="button" className="border border-line px-3 py-1.5 text-sm text-ink-muted" onClick={onClose}>
            {t("interfaces.close")}
          </button>
        </div>
      )}
    </div>
  );
}

function InterfaceRow({
  iface,
  expanded,
  onToggle,
}: {
  iface: PhysicalInterface;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <tr className="border-t border-line align-top">
        <td className="py-3 pr-4 font-medium text-ink">
          <button type="button" className="text-left hover:underline" onClick={onToggle}>
            {iface.name}
          </button>
          {iface.is_management ? (
            <span className="ml-2 font-mono text-[10px] tracking-wide text-accent uppercase">
              {t("interfaces.mgmtBadge")}
            </span>
          ) : null}
        </td>
        <td className={`py-3 pr-4 font-mono text-sm uppercase ${linkTone(iface.link_state)}`}>
          {iface.link_state}
        </td>
        <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{iface.mac_address ?? "—"}</td>
        <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{iface.driver ?? "—"}</td>
        <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{iface.pci_address ?? "—"}</td>
        <td className="py-3 pr-4 font-mono text-sm text-ink-muted">
          {iface.numa_node == null ? "—" : iface.numa_node}
        </td>
        <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{formatSpeed(iface.speed_mbps)}</td>
        <td className="py-3 font-mono text-sm text-ink-muted">{iface.mtu ?? "—"}</td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={8} className="bg-paper-elevated/40 px-2 pb-4">
            <InterfaceEditor iface={iface} onClose={onToggle} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function InterfacesPage() {
  const { t } = useTranslation();
  const interfacesQuery = useInterfaces();
  const rescan = useRescanInterfaces();
  const infoQuery = useSystemInfo();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const bindIp = infoQuery.data?.management_bind_ip;
  const mgmtName = infoQuery.data?.management_interface;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">{t("interfaces.title")}</h2>
          <p className="mt-1 max-w-2xl text-ink-muted">{t("interfaces.subtitle")}</p>
          {mgmtName || bindIp ? (
            <p className="mt-2 font-mono text-xs text-ink-muted">
              {t("interfaces.mgmtStatus", {
                name: mgmtName ?? "—",
                ip: bindIp ?? "—",
              })}
              {bindIp === "0.0.0.0" || !bindIp ? (
                <span className="ml-2 text-warn">{t("interfaces.bindWideWarning")}</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-warn">{t("interfaces.noMgmt")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {rescan.isPending ? t("interfaces.scanning") : t("interfaces.rescan")}
        </button>
      </section>

      {rescan.isSuccess ? (
        <p className="font-mono text-xs text-ink-muted">
          {t("interfaces.scanStats", {
            discovered: rescan.data.discovered,
            created: rescan.data.created,
            updated: rescan.data.updated,
            removed: rescan.data.removed,
          })}
        </p>
      ) : null}

      {rescan.isError ? (
        <p className="text-danger">
          {t("interfaces.rescanFailed", {
            message: rescan.error instanceof Error ? rescan.error.message : t("common.unknownError"),
          })}
        </p>
      ) : null}

      {interfacesQuery.isLoading ? <p className="text-ink-muted">{t("common.loading")}</p> : null}

      {interfacesQuery.isError ? (
        <p className="text-danger">
          {t("interfaces.loadFailed", {
            message:
              interfacesQuery.error instanceof Error
                ? interfacesQuery.error.message
                : t("common.unknownError"),
          })}
        </p>
      ) : null}

      {interfacesQuery.data ? (
        <div className="overflow-x-auto border border-line bg-paper-elevated/40 p-4">
          {interfacesQuery.data.length === 0 ? (
            <p className="text-ink-muted">{t("interfaces.empty")}</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colName")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colLink")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colMac")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colDriver")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colPci")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colNuma")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("interfaces.colSpeed")}</th>
                  <th className="pb-2 font-medium">{t("interfaces.colMtu")}</th>
                </tr>
              </thead>
              <tbody>
                {interfacesQuery.data.map((iface) => (
                  <InterfaceRow
                    key={iface.id}
                    iface={iface}
                    expanded={expandedId === iface.id}
                    onToggle={() => setExpandedId((id) => (id === iface.id ? null : iface.id))}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
