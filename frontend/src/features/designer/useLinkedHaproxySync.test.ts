import { describe, expect, it } from "vitest";
import { linkedSyncAction } from "./useLinkedHaproxySync";

describe("linkedSyncAction", () => {
  it("seeds baseline on first observation without rehydrate", () => {
    expect(linkedSyncAction(undefined, "fp-a")).toBe("baseline");
  });

  it("skips when fingerprint is unchanged", () => {
    expect(linkedSyncAction("fp-a", "fp-a")).toBe("skip");
  });

  it("rehydrates only after a real fingerprint change", () => {
    expect(linkedSyncAction("fp-a", "fp-b")).toBe("rehydrate");
  });
});
