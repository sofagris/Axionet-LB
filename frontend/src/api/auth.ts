import { apiFetch, setAccessToken } from "./client";
import { TokenResponseSchema, UserSchema, type TokenResponse, type User } from "../types/auth";

export function login(username: string, password: string): Promise<TokenResponse> {
  return apiFetch(
    "/api/v1/auth/login",
    (data) => {
      const parsed = TokenResponseSchema.parse(data);
      setAccessToken(parsed.access_token);
      return parsed;
    },
    {
      method: "POST",
      body: { username, password },
      auth: false,
    },
  );
}

export function fetchMe(): Promise<User> {
  return apiFetch("/api/v1/auth/me", (data) => UserSchema.parse(data));
}

export function logout(): Promise<void> {
  return apiFetch("/api/v1/auth/logout", () => undefined, { method: "POST" }).finally(() => {
    setAccessToken(null);
  });
}
