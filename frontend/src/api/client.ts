type ApiFetchOptions = {
  method?: string;
  body?: unknown;
};

async function apiFetch<T>(
  path: string,
  parse: (data: unknown) => T,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
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
