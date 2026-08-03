import { z } from "zod";

export const DesignGraphSchema = z.object({
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .default({ x: 0, y: 0, zoom: 1 }),
});
export type DesignGraph = z.infer<typeof DesignGraphSchema>;

export const DesignFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  graph_json: DesignGraphSchema,
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DesignFlow = z.infer<typeof DesignFlowSchema>;

export type DesignFlowCreatePayload = {
  name: string;
  description?: string | null;
  graph_json?: DesignGraph;
};

export type DesignFlowUpdatePayload = {
  name?: string;
  description?: string | null;
  graph_json?: DesignGraph;
};

export function emptyDesignGraph(): DesignGraph {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
}
