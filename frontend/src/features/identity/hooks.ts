import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGroup,
  createUser,
  deactivateUser,
  deleteGroup,
  fetchGroupMembers,
  fetchGroups,
  fetchUsers,
  setGroupMembers,
  updateGroup,
  updateUser,
} from "../../api/identity";
import type {
  GroupCreatePayload,
  GroupUpdatePayload,
  UserCreatePayload,
  UserUpdatePayload,
} from "../../types/identity";

const usersKey = ["identity", "users"] as const;
const groupsKey = ["identity", "groups"] as const;

export function useUsers() {
  return useQuery({ queryKey: usersKey, queryFn: fetchUsers });
}

export function useGroups() {
  return useQuery({ queryKey: groupsKey, queryFn: fetchGroups });
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: [...groupsKey, groupId, "members"],
    queryFn: () => fetchGroupMembers(groupId!),
    enabled: Boolean(groupId),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserCreatePayload) => createUser(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserUpdatePayload }) =>
      updateUser(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: usersKey });
      void qc.invalidateQueries({ queryKey: groupsKey });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GroupCreatePayload) => createGroup(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: groupsKey }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GroupUpdatePayload }) =>
      updateGroup(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupsKey });
      void qc.invalidateQueries({ queryKey: usersKey });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupsKey });
      void qc.invalidateQueries({ queryKey: usersKey });
    },
  });
}

export function useSetGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      setGroupMembers(id, userIds),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: groupsKey });
      void qc.invalidateQueries({ queryKey: usersKey });
      void qc.invalidateQueries({ queryKey: [...groupsKey, vars.id, "members"] });
    },
  });
}
