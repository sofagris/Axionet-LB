import type {
  HaproxyAcl,
  HaproxyBackend,
  HaproxyErrorFile,
  HaproxyFrontend,
} from "../../types/haproxy";

export type HaproxyConfigSnapshot = {
  frontends: HaproxyFrontend[];
  backends: HaproxyBackend[];
  errorFiles: HaproxyErrorFile[];
  acls: HaproxyAcl[];
};

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Stable fingerprint of live HAProxy config used to detect changes for Designer sync.
 * Order-independent: entities are sorted by name (servers within each backend too).
 */
export function fingerprintHaproxyConfig(snap: HaproxyConfigSnapshot): string {
  const normalized = {
    frontends: sortByName(snap.frontends),
    backends: sortByName(snap.backends).map((b) => ({
      ...b,
      servers: sortByName(b.servers ?? []),
    })),
    errorFiles: sortByName(snap.errorFiles),
    acls: sortByName(snap.acls ?? []),
  };
  return JSON.stringify(normalized);
}
