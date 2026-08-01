import { z } from "zod";
import { apiFetch } from "./client";
import {
  GroupSchema,
  IdentityUserSchema,
  type Group,
  type GroupCreatePayload,
  type GroupUpdatePayload,
  type IdentityUser,
  type UserCreatePayload,
  type UserUpdatePayload,
} from "../types/identity";

export function fetchUsers(): Promise<IdentityUser[]> {
  return apiFetch("/api/v1/users", (data) => z.array(IdentityUserSchema).parse(data));
}

export function createUser(payload: UserCreatePayload): Promise<IdentityUser> {
  return apiFetch("/api/v1/users", (data) => IdentityUserSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateUser(id: string, payload: UserUpdatePayload): Promise<IdentityUser> {
  return apiFetch(`/api/v1/users/${id}`, (data) => IdentityUserSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deactivateUser(id: string): Promise<IdentityUser> {
  return apiFetch(`/api/v1/users/${id}/deactivate`, (data) => IdentityUserSchema.parse(data), {
    method: "POST",
  });
}

export function fetchGroups(): Promise<Group[]> {
  return apiFetch("/api/v1/groups", (data) => z.array(GroupSchema).parse(data));
}

export function createGroup(payload: GroupCreatePayload): Promise<Group> {
  return apiFetch("/api/v1/groups", (data) => GroupSchema.parse(data), {
    method: "POST",
    body: payload,
  });
}

export function updateGroup(id: string, payload: GroupUpdatePayload): Promise<Group> {
  return apiFetch(`/api/v1/groups/${id}`, (data) => GroupSchema.parse(data), {
    method: "PATCH",
    body: payload,
  });
}

export function deleteGroup(id: string): Promise<void> {
  return apiFetch(`/api/v1/groups/${id}`, () => undefined, { method: "DELETE" });
}

export function fetchGroupMembers(id: string): Promise<string[]> {
  return apiFetch(`/api/v1/groups/${id}/members`, (data) => z.array(z.string()).parse(data));
}

export function setGroupMembers(id: string, userIds: string[]): Promise<Group> {
  return apiFetch(`/api/v1/groups/${id}/members`, (data) => GroupSchema.parse(data), {
    method: "PUT",
    body: { user_ids: userIds },
  });
}
