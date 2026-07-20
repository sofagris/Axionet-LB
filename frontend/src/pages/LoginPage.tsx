import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth/AuthProvider";

export function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={params.get("next") || "/"} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate(params.get("next") || "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md border border-line bg-paper-elevated p-8 shadow-sm">
        <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
          {t("common.brand")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("auth.title")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("auth.subtitle")}</p>

        <form className="mt-8 space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("auth.username")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("auth.password")}</span>
            <input
              type="password"
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-accent bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {submitting ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
