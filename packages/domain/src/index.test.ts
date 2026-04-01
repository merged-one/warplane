import { describe, expect, it } from "vitest";
import { chainId } from "./index.js";

describe("chainId", () => {
  it("creates a ChainId from a valid string", () => {
    const id = chainId("2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5");
    expect(id.blockchainId).toBe("2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5");
  });

  it("throws on empty string", () => {
    expect(() => chainId("")).toThrow("blockchainId must be non-empty");
  });
});
