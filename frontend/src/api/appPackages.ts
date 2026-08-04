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
