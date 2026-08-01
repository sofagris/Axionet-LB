import { describe, expect, it } from "vitest";

function parseSuffix(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed.includes("@")) return null;
  const suffix = trimmed.split("@").pop()?.trim().toLowerCase() ?? "";
  return suffix || null;
}

function needsSso(
  username: string,
  localSuffix: string,
  suffixes: { suffix: string; sso: boolean }[],
): boolean {
  const suffix = parseSuffix(username);
  if (!suffix) return false;
  if (suffix === localSuffix) return false;
  const mapped = suffixes.find((s) => s.suffix === suffix);
  return mapped?.sso ?? true;
}

describe("UPN login routing helpers", () => {
  it("treats bare and @internal as local", () => {
    expect(needsSso("Admin", "internal", [])).toBe(false);
    expect(needsSso("Admin@internal", "internal", [])).toBe(false);
  });

  it("requires SSO for mapped oidc suffix", () => {
    expect(
      needsSso("roy@contoso.com", "internal", [{ suffix: "contoso.com", sso: true }]),
    ).toBe(true);
  });
});
