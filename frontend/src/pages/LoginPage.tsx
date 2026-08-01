import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { oidcStartUrl } from "../api/authSources";
import { useAuth } from "../features/auth/AuthProvider";
import { useLoginOptions } from "../features/identity/authSourceHooks";

function parseSuffix(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed.includes("@")) return null;
  const suffix = trimmed.split("@").pop()?.trim().toLowerCase() ?? "";
  return suffix || null;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, login, completeOidcLogin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const optionsQuery = useLoginOptions();
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oidcBusy, setOidcBusy] = useState(false);

  const localSuffix = optionsQuery.data?.local_suffix ?? "internal";
  const suffix = parseSuffix(username);
  const needsSso = useMemo(() => {
    if (!suffix) return false;
    if (suffix === localSuffix) return false;
    const mapped = optionsQuery.data?.suffixes.find((s) => s.suffix === suffix);
    return mapped?.sso ?? true;
  }, [suffix, localSuffix, optionsQuery.data]);

  useEffect(() => {
    const token = params.get("oidc_token");
    const oidcError = params.get("oidc_error");
    if (oidcError) {
      setError(oidcError);
      const next = new URLSearchParams(params);
      next.delete("oidc_error");
      setParams(next, { replace: true });
      return;
    }
    if (!token) return;
    setOidcBusy(true);
    void completeOidcLogin(token)
      .then(() => {
        const next = new URLSearchParams(params);
        next.delete("oidc_token");
        setParams(next, { replace: true });
        navigate(params.get("next") || "/", { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.unknownError"));
        setAccessTokenCleanup();
      })
      .finally(() => setOidcBusy(false));
  }, [params, completeOidcLogin, navigate, setParams, t]);

  if ((!loading && user) || oidcBusy) {
    if (user) {
      return <Navigate to={params.get("next") || "/"} replace />;
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (needsSso) {
        window.location.assign(oidcStartUrl(username.trim()));
        return;
      }
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
        <p className="mt-2 text-xs text-ink-muted">{t("auth.localBreakGlass")}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {t("auth.upnHint", { suffix: localSuffix })}
        </p>

        <form className="mt-8 space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("auth.usernameUpn")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm text-ink"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          {!needsSso ? (
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
          ) : (
            <p className="text-sm text-ink-muted">{t("auth.ssoRequired")}</p>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || oidcBusy}
            className="w-full border border-accent bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {needsSso
              ? submitting
                ? t("auth.continuingSso")
                : t("auth.continueSso")
              : submitting
                ? t("auth.signingIn")
                : t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}

function setAccessTokenCleanup() {
  try {
    localStorage.removeItem("ax-lb-token");
  } catch {
    // ignore
  }
}
