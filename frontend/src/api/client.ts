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
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }
  const data: unknown = await response.json();
  return parse(data);
}

export { apiFetch };
