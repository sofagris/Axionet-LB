import { z } from "zod";

export const RevisionSummarySchema = z.object({
  id: z.string(),
  service_instance_id: z.string(),
  revision_number: z.number().int(),
  validation_status: z.enum(["valid", "invalid", "unknown"]),
  deployment_status: z.enum(["pending", "deployed", "failed", "superseded"]),
  created_by: z.string(),
  created_at: z.string(),
  deployed_at: z.string().nullable().optional(),
});

export const RevisionReadSchema = RevisionSummarySchema.extend({
  configuration: z.record(z.string(), z.unknown()),
  rendered_configuration: z.string(),
  validation_output: z.string(),
  diff_from_previous: z.string().nullable().optional(),
});

export type RevisionSummary = z.infer<typeof RevisionSummarySchema>;
export type RevisionRead = z.infer<typeof RevisionReadSchema>;
