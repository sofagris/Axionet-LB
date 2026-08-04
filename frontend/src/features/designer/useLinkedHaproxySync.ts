import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  fingerprintHaproxyConfig,
  type HaproxyConfigSnapshot,
} from "./haproxyConfigFingerprint";
import {
  fetchHaproxyConfigSnapshot,
  linkedHaproxyGroups,
  type LinkedHaproxyGroup,
} from "./haproxyRehydrate";
import type { DesignerNode } from "./types";

const SYNC_INTERVAL_MS = 8_000;

/** Decide how a polled live-config fingerprint should be handled. */
export function linkedSyncAction(
  previous: string | undefined,
  next: string,
): "skip" | "baseline" | "rehydrate" {
  if (previous === next) return "skip";
  if (previous === undefined) return "baseline";
  return "rehydrate";
}

type Options = {
  nodes: DesignerNode[];
  /** Last applied fingerprint per serviceId (shared with drop/manual refresh). */
  fingerprintsRef: MutableRefObject<Map<string, string>>;
  /** Skip overlapping rehydrates for the same groupId. */
  inFlightRef: MutableRefObject<Set<string>>;
  /**
   * Called when live config fingerprint differs from the last applied one.
   * Caller should rehydrate and update fingerprintsRef.
   */
  onConfigChanged: (link: LinkedHaproxyGroup, snapshot: HaproxyConfigSnapshot) => void;
  enabled?: boolean;
};

/**
 * Poll live HAProxy config for linked instance groups on the Designer canvas.
 * Triggers onConfigChanged only when the fingerprint changes from a previously
 * recorded baseline (first observation after load only seeds the map so opening
 * a design does not clobber the saved canvas).
 */
export function useLinkedHaproxySync({
  nodes,
  fingerprintsRef,
  inFlightRef,
  onConfigChanged,
  enabled = true,
}: Options) {
  const links = useMemo(() => linkedHaproxyGroups(nodes), [nodes]);
  const serviceIds = useMemo(
    () => [...new Set(links.map((l) => l.serviceId))],
    [links],
  );

  const linksByService = useMemo(() => {
    const map = new Map<string, LinkedHaproxyGroup[]>();
    for (const link of links) {
      const list = map.get(link.serviceId) ?? [];
      list.push(link);
      map.set(link.serviceId, list);
    }
    return map;
  }, [links]);

  const linksByServiceRef = useRef(linksByService);
  useEffect(() => {
    linksByServiceRef.current = linksByService;
  }, [linksByService]);

  const onConfigChangedRef = useRef(onConfigChanged);
  useEffect(() => {
    onConfigChangedRef.current = onConfigChanged;
  }, [onConfigChanged]);

  const queries = useQueries({
    queries: serviceIds.map((serviceId) => ({
      queryKey: ["haproxy", serviceId, "designer-sync"] as const,
      queryFn: () => fetchHaproxyConfigSnapshot(serviceId),
      refetchInterval: SYNC_INTERVAL_MS,
      enabled: enabled && serviceIds.length > 0,
      staleTime: SYNC_INTERVAL_MS / 2,
    })),
  });

  useEffect(() => {
    if (!enabled) return;
    for (let i = 0; i < serviceIds.length; i++) {
      const serviceId = serviceIds[i];
      const q = queries[i];
      if (!q?.isSuccess || !q.data) continue;

      const fp = fingerprintHaproxyConfig(q.data);
      const previous = fingerprintsRef.current.get(serviceId);
      const action = linkedSyncAction(previous, fp);
      if (action === "skip") continue;
      if (action === "baseline") {
        fingerprintsRef.current.set(serviceId, fp);
        continue;
      }

      const groupLinks = linksByServiceRef.current.get(serviceId) ?? [];
      for (const link of groupLinks) {
        if (inFlightRef.current.has(link.groupId)) continue;
        onConfigChangedRef.current(link, q.data);
      }
    }
    // queries array identity changes often; depend on dataUpdatedAt + status.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: react to poll results
  }, [
    enabled,
    serviceIds,
    fingerprintsRef,
    inFlightRef,
    // Serialize query freshness so we re-run when poll completes
    queries.map((q) => `${q.dataUpdatedAt}:${q.status}`).join("|"),
  ]);
}
