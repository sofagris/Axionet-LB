import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth/AuthProvider";
import {
  useCreateGroup,
  useCreateUser,
  useDeactivateUser,
  useDeleteGroup,
  useGroupMembers,
  useGroups,
  useSetGroupMembers,
  useUpdateGroup,
  useUpdateUser,
  useUsers,
} from "../features/identity/hooks";
import type { Group, IdentityUser, PlatformRole } from "../types/identity";

type Tab = "users" | "groups";

const ROLES: PlatformRole[] = ["admin", "operator", "viewer"];

function IdentityModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-line bg-paper p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            className="font-mono text-xs text-ink-muted uppercase hover:text-ink"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (loading) {
    return <p className="text-ink-muted">{t("common.loading")}</p>;
  }
  if (!user || user.effective_role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-line pb-6">
        <p className="font-mono text-[10px] tracking-[0.16em] text-domain-system uppercase">
          {t("users.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{t("users.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("users.subtitle")}</p>
      </header>

      <div className="flex gap-2 border-b border-line">
        <button
          type="button"
          className={[
            "px-3 py-2 text-sm",
            tab === "users"
              ? "border-b-2 border-domain-system font-medium text-ink"
              : "text-ink-muted",
          ].join(" ")}
          onClick={() => setTab("users")}
        >
          {t("users.tabs.users")}
        </button>
        <button
          type="button"
          className={[
            "px-3 py-2 text-sm",
            tab === "groups"
              ? "border-b-2 border-domain-system font-medium text-ink"
              : "text-ink-muted",
          ].join(" ")}
          onClick={() => setTab("groups")}
        >
          {t("users.tabs.groups")}
        </button>
      </div>

      {tab === "users" ? <UsersPanel /> : <GroupsPanel />}
    </div>
  );
}

function UsersPanel() {
  const { t } = useTranslation();
  const usersQuery = useUsers();
  const groupsQuery = useGroups();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deactivateMutation = useDeactivateUser();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IdentityUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PlatformRole>("viewer");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);

  const groups = groupsQuery.data ?? [];

  function resetForm() {
    setUsername("");
    setPassword("");
    setRole("viewer");
    setEmail("");
    setDisplayName("");
    setGroupIds([]);
    setEditing(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(user: IdentityUser) {
    setEditing(user);
    setShowForm(true);
    setUsername(user.username);
    setPassword("");
    setRole((user.role as PlatformRole) || "viewer");
    setEmail(user.email ?? "");
    setDisplayName(user.display_name ?? "");
    const ids = groups.filter((g) => user.groups.includes(g.name)).map((g) => g.id);
    setGroupIds(ids);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: {
            role,
            email: email.trim() || null,
            display_name: displayName.trim() || null,
            group_ids: groupIds,
            ...(password ? { password } : {}),
          },
        });
      } else {
        await createMutation.mutateAsync({
          username: username.trim(),
          password,
          role,
          email: email.trim() || null,
          display_name: displayName.trim() || null,
          group_ids: groupIds,
        });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  function toggleGroup(id: string) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          className="border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          {t("users.addUser")}
        </button>
      </div>

      <IdentityModal
        open={showForm}
        title={editing ? t("users.editUser") : t("users.createUser")}
        onClose={resetForm}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          {!editing ? (
            <label className="block text-sm">
              <span className="text-ink-muted">{t("auth.username")}</span>
              <input
                className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
                autoFocus
              />
            </label>
          ) : (
            <p className="font-mono text-sm text-ink">{editing.username}</p>
          )}
          <label className="block text-sm">
            <span className="text-ink-muted">
              {editing ? t("users.newPassword") : t("auth.password")}
            </span>
            <input
              type="password"
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editing}
              minLength={editing ? undefined : 8}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("users.role")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm text-ink"
              value={role}
              onChange={(e) => setRole(e.target.value as PlatformRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`users.roles.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("users.displayName")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm text-ink"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={128}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("users.email")}</span>
            <input
              type="email"
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm text-ink"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </label>
          {groups.length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="text-sm text-ink-muted">{t("users.membership")}</legend>
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                  />
                  {g.name}{" "}
                  <span className="font-mono text-xs text-ink-muted">({g.role})</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="border border-domain-system bg-domain-system-soft px-3 py-1.5 text-sm text-domain-system"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink-muted"
              onClick={resetForm}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </IdentityModal>

      {usersQuery.isLoading ? <p className="text-ink-muted">{t("common.loading")}</p> : null}
      {usersQuery.isError ? <p className="text-danger">{t("users.loadFailed")}</p> : null}

      <ul className="divide-y divide-line border border-line">
        {(usersQuery.data ?? []).map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {u.display_name || u.username}
                {!u.is_active ? (
                  <span className="ml-2 font-mono text-xs text-warn">{t("users.inactive")}</span>
                ) : null}
              </p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">
                {u.username} · {t("users.role")}: {u.role} · {t("users.effectiveRole")}:{" "}
                {u.effective_role}
                {u.groups.length ? ` · ${u.groups.join(", ")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-line px-2.5 py-1 text-xs text-ink"
                onClick={() => startEdit(u)}
              >
                {t("users.edit")}
              </button>
              {u.is_active ? (
                <button
                  type="button"
                  className="border border-danger/40 px-2.5 py-1 text-xs text-danger"
                  disabled={deactivateMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t("users.confirmDeactivate", { user: u.username }))) {
                      void deactivateMutation.mutateAsync(u.id).catch((err: unknown) => {
                        window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                      });
                    }
                  }}
                >
                  {t("users.deactivate")}
                </button>
              ) : (
                <button
                  type="button"
                  className="border border-line px-2.5 py-1 text-xs text-ink"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    void updateMutation
                      .mutateAsync({ id: u.id, payload: { is_active: true } })
                      .catch((err: unknown) => {
                        window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                      });
                  }}
                >
                  {t("users.activate")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupsPanel() {
  const { t } = useTranslation();
  const groupsQuery = useGroups();
  const usersQuery = useUsers();
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const deleteMutation = useDeleteGroup();
  const setMembersMutation = useSetGroupMembers();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [membersFor, setMembersFor] = useState<Group | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<PlatformRole>("viewer");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const membersQuery = useGroupMembers(membersFor?.id ?? null);

  useEffect(() => {
    if (membersQuery.data) {
      setSelectedMembers(membersQuery.data);
    }
  }, [membersQuery.data]);

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  function resetForm() {
    setName("");
    setDescription("");
    setRole("viewer");
    setEditing(null);
    setShowForm(false);
    setFormError(null);
  }

  function startEdit(group: Group) {
    setEditing(group);
    setShowForm(true);
    setName(group.name);
    setDescription(group.description);
    setRole((group.role as PlatformRole) || "viewer");
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: { name: name.trim(), description, role },
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description,
          role,
        });
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  async function saveMembers() {
    if (!membersFor) return;
    setMembersError(null);
    try {
      await setMembersMutation.mutateAsync({ id: membersFor.id, userIds: selectedMembers });
      setMembersFor(null);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : t("common.unknownError"));
    }
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          className="border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          {t("users.addGroup")}
        </button>
      </div>

      <IdentityModal
        open={showForm}
        title={editing ? t("users.editGroup") : t("users.createGroup")}
        onClose={resetForm}
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <label className="block text-sm">
            <span className="text-ink-muted">{t("users.groupName")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={64}
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("users.groupDescription")}</span>
            <textarea
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm text-ink"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={512}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("users.groupRole")}</span>
            <select
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm text-ink"
              value={role}
              onChange={(e) => setRole(e.target.value as PlatformRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`users.roles.${r}`)}
                </option>
              ))}
            </select>
          </label>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="border border-domain-system bg-domain-system-soft px-3 py-1.5 text-sm text-domain-system"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink-muted"
              onClick={resetForm}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </IdentityModal>

      <IdentityModal
        open={Boolean(membersFor)}
        title={t("users.editMembers", { group: membersFor?.name ?? "" })}
        onClose={() => {
          setMembersFor(null);
          setMembersError(null);
        }}
      >
        <div className="space-y-3">
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(u.id)}
                  onChange={() => toggleMember(u.id)}
                  disabled={!u.is_active && !selectedMembers.includes(u.id)}
                />
                {u.username}
                {!u.is_active ? (
                  <span className="font-mono text-xs text-warn">{t("users.inactive")}</span>
                ) : null}
              </label>
            ))}
          </div>
          {membersError ? <p className="text-sm text-danger">{membersError}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="border border-domain-system bg-domain-system-soft px-3 py-1.5 text-sm text-domain-system"
              disabled={setMembersMutation.isPending}
              onClick={() => void saveMembers()}
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink-muted"
              onClick={() => {
                setMembersFor(null);
                setMembersError(null);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </IdentityModal>

      {groupsQuery.isLoading ? <p className="text-ink-muted">{t("common.loading")}</p> : null}
      {groupsQuery.isError ? <p className="text-danger">{t("users.loadFailed")}</p> : null}

      <ul className="divide-y divide-line border border-line">
        {(groupsQuery.data ?? []).map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{g.name}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {g.description || t("users.noDescription")} · {t("users.role")}: {g.role} ·{" "}
                {t("users.memberCount", { count: g.member_count })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-line px-2.5 py-1 text-xs text-ink"
                onClick={() => {
                  setMembersFor(g);
                  setMembersError(null);
                }}
              >
                {t("users.members")}
              </button>
              <button
                type="button"
                className="border border-line px-2.5 py-1 text-xs text-ink"
                onClick={() => startEdit(g)}
              >
                {t("users.edit")}
              </button>
              <button
                type="button"
                className="border border-danger/40 px-2.5 py-1 text-xs text-danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("users.confirmDeleteGroup", { group: g.name }))) {
                    void deleteMutation.mutateAsync(g.id).catch((err: unknown) => {
                      window.alert(err instanceof Error ? err.message : t("common.unknownError"));
                    });
                  }
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
