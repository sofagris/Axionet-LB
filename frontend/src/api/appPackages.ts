import { z } from "zod";
import { apiFetch } from "./client";

const DesignerPropFieldSchema = z.object({
  key: z.string(),
  labelKey: z.string(),
  placeholder: z.string().optional(),
  default: z.string().optional(),
});

const DesignerManifestSchema = z.object({
  catalogId: z.string(),
  serviceType: z.string(),
  components: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      role: z.string(),
    }),
  ),
  chain: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().optional(),
    }),
  ),
  roles: z.record(
    z.string(),
    z.object({
      props: z.array(DesignerPropFieldSchema),
    }),
  ),
  hydrate: z.enum(["none", "onDrop", "poll"]).optional(),
  detailPathTemplate: z.string().optional(),
  applySteps: z
    .object({
      createUnbound: z
        .object({ hrefTemplate: z.string(), messageKey: z.string() })
        .optional(),
      openBound: z
        .object({ hrefTemplate: z.string(), messageKey: z.string() })
        .optional(),
      componentExtras: z
        .array(
          z.object({
            whenRole: z.string(),
            hrefTemplate: z.string(),
            messageKey: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type ApiDesignerManifest = z.infer<typeof DesignerManifestSchema>;

const AppPackageSummarySchema = z.object({
  id: z.string(),
  serviceType: z.string(),
  version: z.string(),
  name: z.string(),
  summary: z.string(),
  reference: z.boolean().optional(),
  hydrate: z.enum(["none", "onDrop", "poll"]).optional(),
  actions: z.array(z.string()).optional(),
});

export type AppPackageSummary = z.infer<typeof AppPackageSummarySchema>;

const AppPackageCatalogCardSchema = z.object({
  id: z.string(),
  serviceType: z.string(),
  version: z.string(),
  reference: z.boolean().optional(),
  name: z.string(),
  summary: z.string(),
  description: z.string(),
  kind: z.string(),
  category: z.string(),
  brand: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  primaryAction: z.string().nullable().optional(),
  implementationHint: z.string().nullable().optional(),
  notes: z.array(z.string()).default([]),
  flowNodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        role: z.string(),
      }),
    )
    .default([]),
  flowEdges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
      }),
    )
    .default([]),
});

export type AppPackageCatalogCard = z.infer<typeof AppPackageCatalogCardSchema>;

export function fetchDesignerManifests(options?: {
  includeReference?: boolean;
}): Promise<ApiDesignerManifest[]> {
  const params = new URLSearchParams();
  if (options?.includeReference) params.set("includeReference", "true");
  const qs = params.toString();
  return apiFetch(
    `/api/v1/app-packages/designer-manifests${qs ? `?${qs}` : ""}`,
    (data) => z.array(DesignerManifestSchema).parse(data),
  );
}

export function fetchAppPackages(options?: {
  includeReference?: boolean;
}): Promise<AppPackageSummary[]> {
  const params = new URLSearchParams();
  if (options?.includeReference) params.set("includeReference", "true");
  const qs = params.toString();
  return apiFetch(`/api/v1/app-packages${qs ? `?${qs}` : ""}`, (data) =>
    z.array(AppPackageSummarySchema).parse(data),
  );
}

export function fetchAppPackageCatalog(options?: {
  includeReference?: boolean;
}): Promise<AppPackageCatalogCard[]> {
  const params = new URLSearchParams();
  if (options?.includeReference) params.set("includeReference", "true");
  const qs = params.toString();
  return apiFetch(`/api/v1/app-packages/catalog${qs ? `?${qs}` : ""}`, (data) =>
    z.array(AppPackageCatalogCardSchema).parse(data),
  );
}

const AppStorePackageSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  summary: z.string(),
  source: z.enum(["bundled", "github"]),
  path: z.string().optional().nullable(),
  archiveUrl: z.string().optional().nullable(),
  repository: z.string().optional().nullable(),
  installed: z.boolean(),
  installedVersion: z.string().optional().nullable(),
});

const AppStoreIndexSchema = z.object({
  apiVersion: z.string(),
  name: z.string(),
  packages: z.array(AppStorePackageSchema),
});

export type AppStoreIndex = z.infer<typeof AppStoreIndexSchema>;
export type AppStorePackage = z.infer<typeof AppStorePackageSchema>;

const AppPackageInstallResultSchema = z.object({
  id: z.string(),
  version: z.string(),
  status: z.enum(["installed", "already_installed"]),
});

export type AppPackageInstallResult = z.infer<typeof AppPackageInstallResultSchema>;

export function fetchAppStore(options?: {
  includeReference?: boolean;
}): Promise<AppStoreIndex> {
  const params = new URLSearchParams();
  if (options?.includeReference) params.set("includeReference", "true");
  const qs = params.toString();
  return apiFetch(`/api/v1/app-packages/store${qs ? `?${qs}` : ""}`, (data) =>
    AppStoreIndexSchema.parse(data),
  );
}

export function installAppPackage(payload: {
  packageId?: string;
  archiveUrl?: string;
}): Promise<AppPackageInstallResult> {
  return apiFetch(
    "/api/v1/app-packages/install",
    (data) => AppPackageInstallResultSchema.parse(data),
    {
      method: "POST",
      body: payload,
    },
  );
}
