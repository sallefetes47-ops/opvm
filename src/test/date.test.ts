import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { formatDateInput, parseDateInput, DATE_INPUT_PATTERN } from "../lib/date";

describe("date formatting (dd/MM/yyyy)", () => {
  it("formats day/month/year input while typing", () => {
    expect(formatDateInput("")).toBe("");
    expect(formatDateInput("25")).toBe("25");
    expect(formatDateInput("2502")).toBe("25/02");
    expect(formatDateInput("250220")).toBe("25/02/20");
    expect(formatDateInput("25022026")).toBe("25/02/2026");
    expect(formatDateInput("25/2/2026")).toBe("25/02/2026");
    expect(formatDateInput("25-02-2026")).toBe("25/02/2026");
    expect(formatDateInput("٢٥/٠٢/٢٠٢٦")).toBe("25/02/2026");
  });

  it("also accepts and converts year-first full dates", () => {
    expect(formatDateInput("2026/2/25")).toBe("25/02/2026");
    expect(formatDateInput("2026-02-25")).toBe("25/02/2026");
    expect(formatDateInput("20260225")).toBe("25/02/2026");
    expect(formatDateInput("20260225xxxx")).toBe("25/02/2026");
    expect(formatDateInput("2026")).toBe("2026");
    expect(formatDateInput("202602")).toBe("2026/02");
    expect(formatDateInput("2026022")).toBe("2026/02/2");
  });

  it("parses only valid dd/MM/yyyy dates", () => {
    const reference = new Date(2026, 0, 1);

    const valid = parseDateInput("25/02/2026", reference);
    expect(valid).toBeDefined();
    expect(format(valid!, DATE_INPUT_PATTERN)).toBe("25/02/2026");

    expect(parseDateInput("25/13/2026", reference)).toBeUndefined();
    expect(parseDateInput("29/02/2025", reference)).toBeUndefined();

    const leap = parseDateInput("29/02/2024", reference);
    expect(leap).toBeDefined();
    expect(format(leap!, DATE_INPUT_PATTERN)).toBe("29/02/2024");
  });
});

