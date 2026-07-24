import { z } from "zod";

export const WidgetTypeSchema = z.enum(["traffic_flow"]);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const DashboardWidgetSchema = z.object({
  id: z.string(),
  type: WidgetTypeSchema,
  config: z.record(z.string(), z.unknown()).default({}),
});
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;

export const DashboardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  widgets: z.array(DashboardWidgetSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Dashboard = z.infer<typeof DashboardSchema>;

export type DashboardCreatePayload = {
  name: string;
  description?: string | null;
};

export type DashboardUpdatePayload = {
  name?: string;
  description?: string | null;
  widgets?: DashboardWidget[];
};

export type DashboardWidgetCreatePayload = {
  type: WidgetType;
  config?: Record<string, unknown>;
};
