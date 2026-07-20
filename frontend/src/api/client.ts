const TOKEN_KEY = "ax-lb-token";

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage failures (private mode)
  }
}

type ApiFetchOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

async function apiFetch<T>(
  path: string,
  parse: (data: unknown) => T,
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: Object.keys(headers).length ? headers : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && options.auth !== false && !path.includes("/auth/login")) {
    setAccessToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody: unknown = await response.json();
      if (typeof errorBody === "object" && errorBody !== null && "detail" in errorBody) {
        const raw = (errorBody as { detail: unknown }).detail;
        if (typeof raw === "string") {
          detail = raw;
        } else if (
          typeof raw === "object" &&
          raw !== null &&
          "message" in raw &&
          typeof (raw as { message: unknown }).message === "string"
        ) {
          detail = (raw as { message: string }).message;
        }
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(`API ${response.status}: ${detail}`);
  }
  if (response.status === 204) {
    return parse(undefined);
  }
  const data: unknown = await response.json();
  return parse(data);
}

export { apiFetch };
