async function apiFetch<T>(path: string, parse: (data: unknown) => T): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }
  const data: unknown = await response.json();
  return parse(data);
}

export { apiFetch };
