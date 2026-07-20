import { z } from "zod";
import { apiFetch } from "./client";
import {
  RevisionReadSchema,
  RevisionSummarySchema,
  type RevisionRead,
  type RevisionSummary,
} from "../types/revisions";

const base = (id: string) => `/api/v1/instances/${id}/revisions`;

export function fetchRevisions(instanceId: string): Promise<RevisionSummary[]> {
  return apiFetch(base(instanceId), (data) => z.array(RevisionSummarySchema).parse(data));
}

export function fetchRevision(instanceId: string, revisionId: string): Promise<RevisionRead> {
  return apiFetch(`${base(instanceId)}/${revisionId}`, (data) => RevisionReadSchema.parse(data));
}

export function restoreRevision(instanceId: string, revisionId: string): Promise<RevisionRead> {
  return apiFetch(
    `${base(instanceId)}/${revisionId}/restore`,
    (data) => RevisionReadSchema.parse(data),
    { method: "POST" },
  );
}
