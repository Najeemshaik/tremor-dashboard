import { describe, expect, it } from "vitest";
import { normalizeStoredPayload } from "../services/storage/storageTypes.js";

describe("normalizeStoredPayload", () => {
  it("returns null for invalid payloads", () => {
    expect(normalizeStoredPayload(null)).toBeNull();
    expect(normalizeStoredPayload(undefined)).toBeNull();
    expect(normalizeStoredPayload("x")).toBeNull();
    expect(normalizeStoredPayload({})).toBeNull();
    expect(normalizeStoredPayload({ profiles: "bad" })).toBeNull();
  });

  it("keeps array sections and drops invalid sections", () => {
    const payload = normalizeStoredPayload({
      profiles: [{ id: "p1" }],
      sequences: "bad",
      sessions: []
    });

    expect(payload).toEqual({
      profiles: [{ id: "p1" }],
      sequences: undefined,
      sessions: []
    });
  });
});
