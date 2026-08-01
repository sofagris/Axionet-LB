import { useAuth } from "./AuthProvider";

export type PlatformRole = "admin" | "operator" | "viewer";

function normalizeRole(role: string | undefined | null): PlatformRole {
  if (role === "admin" || role === "operator" || role === "viewer") return role;
  return "viewer";
}

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeRole(user?.effective_role);
  return {
    role,
    isAdmin: role === "admin",
    canMutate: role === "admin" || role === "operator",
    isViewer: role === "viewer",
  };
}
