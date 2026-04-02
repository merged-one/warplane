/**
 * Unit tests for output helpers.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  setJsonMode,
  isJsonMode,
  printJson,
  heading,
  detail,
  table,
  hint,
  status,
  warn,
  truncate,
  shortId,
} from "./output.js";

// Capture console.log output
let logged: string[];
const origLog = console.log;
const origErr = console.error;

beforeEach(() => {
  logged = [];
  console.log = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  setJsonMode(false);
});

afterEach(() => {
  console.log = origLog;
  console.error = origErr;
  setJsonMode(false);
});

// ---------------------------------------------------------------------------
// JSON mode toggle
// ---------------------------------------------------------------------------

describe("setJsonMode / isJsonMode", () => {
  it("defaults to false", () => {
    expect(isJsonMode()).toBe(false);
  });

  it("can be toggled on", () => {
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);
  });

  it("can be toggled back off", () => {
    setJsonMode(true);
    setJsonMode(false);
    expect(isJsonMode()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// printJson
// ---------------------------------------------------------------------------

describe("printJson", () => {
  it("outputs formatted JSON", () => {
    printJson({ foo: 1, bar: [2, 3] });
    expect(logged).toHaveLength(1);
    const parsed = JSON.parse(logged[0]!);
    expect(parsed).toEqual({ foo: 1, bar: [2, 3] });
  });

  it("handles null and primitives", () => {
    printJson(null);
    expect(JSON.parse(logged[0]!)).toBeNull();
  });

  it("pretty-prints with 2-space indent", () => {
    printJson({ a: 1 });
    expect(logged[0]).toContain("\n");
    expect(logged[0]).toContain("  ");
  });
});

// ---------------------------------------------------------------------------
// heading
// ---------------------------------------------------------------------------

describe("heading", () => {
  it("prints text and underline in TTY mode", () => {
    heading("Test Title");
    expect(logged).toHaveLength(2);
    expect(logged[0]).toContain("Test Title");
    expect(logged[1]).toMatch(/^─+$/);
    expect(logged[1]!.length).toBe("Test Title".length);
  });

  it("suppressed in JSON mode", () => {
    setJsonMode(true);
    heading("Suppressed");
    expect(logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detail
// ---------------------------------------------------------------------------

describe("detail", () => {
  it("prints padded label and value", () => {
    detail("Label", "value");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("Label");
    expect(logged[0]).toContain("value");
  });

  it("shows dash for undefined", () => {
    detail("Missing", undefined);
    expect(logged[0]).toContain("—");
  });

  it("shows dash for null", () => {
    detail("Null", null);
    expect(logged[0]).toContain("—");
  });

  it("converts numbers and booleans to string", () => {
    detail("Num", 42);
    expect(logged[0]).toContain("42");
  });

  it("suppressed in JSON mode", () => {
    setJsonMode(true);
    detail("Label", "value");
    expect(logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

describe("table", () => {
  it("renders headers, separator, and rows", () => {
    table(
      ["NAME", "AGE"],
      [
        ["Alice", "30"],
        ["Bob", "25"],
      ],
    );
    expect(logged).toHaveLength(4); // header + separator + 2 rows
    expect(logged[0]).toContain("NAME");
    expect(logged[0]).toContain("AGE");
    expect(logged[1]).toMatch(/─/);
    expect(logged[2]).toContain("Alice");
    expect(logged[2]).toContain("30");
    expect(logged[3]).toContain("Bob");
  });

  it("shows no-results message for empty rows", () => {
    table(["COL"], []);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("no results");
  });

  it("handles missing cell values", () => {
    table(["A", "B"], [["val", undefined as unknown as string]]);
    expect(logged).toHaveLength(3);
    // Should not throw
  });

  it("caps column width at 60", () => {
    const longVal = "x".repeat(100);
    table(["COL"], [[longVal]]);
    // The rendered value should be truncated to 60
    expect(logged[2]!.trim().length).toBeLessThanOrEqual(60);
  });

  it("auto-sizes columns to fit content", () => {
    table(["SHORT", "LONGER HEADER"], [["a", "b"]]);
    // The separator line widths should match header widths
    const sepParts = logged[1]!.split("  ");
    expect(sepParts[1]!.length).toBe("LONGER HEADER".length);
  });
});

// ---------------------------------------------------------------------------
// hint
// ---------------------------------------------------------------------------

describe("hint", () => {
  it("prints text", () => {
    hint("Try this next");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("Try this next");
  });

  it("suppressed in JSON mode", () => {
    setJsonMode(true);
    hint("Suppressed");
    expect(logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

describe("status", () => {
  it("prints check mark for ok=true", () => {
    status(true, "node", "v20");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("node");
    expect(logged[0]).toContain("v20");
    expect(logged[0]).toContain("✓");
  });

  it("prints cross for ok=false", () => {
    status(false, "api", "down");
    expect(logged[0]).toContain("✗");
    expect(logged[0]).toContain("api");
    expect(logged[0]).toContain("down");
  });

  it("works without detail", () => {
    status(true, "check");
    expect(logged[0]).toContain("check");
  });

  it("suppressed in JSON mode", () => {
    setJsonMode(true);
    status(true, "check");
    expect(logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// warn
// ---------------------------------------------------------------------------

describe("warn", () => {
  it("prints warning symbol", () => {
    warn("optional", "not installed");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("!");
    expect(logged[0]).toContain("optional");
    expect(logged[0]).toContain("not installed");
  });

  it("works without detail", () => {
    warn("check");
    expect(logged[0]).toContain("check");
  });

  it("suppressed in JSON mode", () => {
    setJsonMode(true);
    warn("suppressed");
    expect(logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe("truncate", () => {
  it("returns string unchanged if under max", () => {
    expect(truncate("short", 10)).toBe("short");
  });

  it("returns string unchanged if exactly max", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });

  it("truncates with ellipsis if over max", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(truncate("abcdefghij", 5).length).toBe(5);
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles max of 1", () => {
    expect(truncate("abc", 1)).toBe("…");
  });
});

// ---------------------------------------------------------------------------
// shortId
// ---------------------------------------------------------------------------

describe("shortId", () => {
  it("truncates long IDs to 12 chars + ellipsis", () => {
    const long = "4d8580870bf0d1c30bc561d4d6039eca0750a5f62aba0578dd0b65b0b572c67c";
    const result = shortId(long);
    expect(result).toBe("4d8580870bf0…");
    expect(result.length).toBe(13);
  });

  it("returns short IDs unchanged", () => {
    expect(shortId("abcdef1234567890")).toBe("abcdef1234567890");
  });

  it("returns IDs at the boundary unchanged", () => {
    expect(shortId("1234567890123456")).toBe("1234567890123456"); // 16 chars
  });

  it("truncates IDs longer than 16", () => {
    expect(shortId("12345678901234567")).toBe("123456789012…"); // 17 chars -> truncated
  });
});
