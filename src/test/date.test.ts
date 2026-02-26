import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { formatYYYYMMDDInput, parseYYYYMMDD, YYYYMMDD_PATTERN } from "../lib/date";

describe("date formatting (yyyy/MM/dd)", () => {
  it("formats user input to yyyy/MM/dd while typing", () => {
    expect(formatYYYYMMDDInput("")).toBe("");
    expect(formatYYYYMMDDInput("2")).toBe("2");
    expect(formatYYYYMMDDInput("2026")).toBe("2026");
    expect(formatYYYYMMDDInput("20260")).toBe("2026/0");
    expect(formatYYYYMMDDInput("202602")).toBe("2026/02");
    expect(formatYYYYMMDDInput("2026022")).toBe("2026/02/2");
    expect(formatYYYYMMDDInput("20260225")).toBe("2026/02/25");
    expect(formatYYYYMMDDInput("2026-02-25")).toBe("2026/02/25");
    expect(formatYYYYMMDDInput("2026/2/25")).toBe("2026/02/25");
    expect(formatYYYYMMDDInput("٢٠٢٦/٢/٢٥")).toBe("2026/02/25");
    expect(formatYYYYMMDDInput("20260225xxxx")).toBe("2026/02/25");
  });

  it("parses only valid yyyy/MM/dd dates", () => {
    const reference = new Date(2026, 0, 1);

    const valid = parseYYYYMMDD("2026/02/25", reference);
    expect(valid).toBeDefined();
    expect(format(valid!, YYYYMMDD_PATTERN)).toBe("2026/02/25");

    expect(parseYYYYMMDD("2026/13/01", reference)).toBeUndefined();
    expect(parseYYYYMMDD("2025/02/29", reference)).toBeUndefined();

    const leap = parseYYYYMMDD("2024/02/29", reference);
    expect(leap).toBeDefined();
    expect(format(leap!, YYYYMMDD_PATTERN)).toBe("2024/02/29");
  });
});
