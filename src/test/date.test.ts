import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { DDMMYYYY_PATTERN, formatDDMMYYYYInput, parseDDMMYYYY } from "../lib/date";

describe("date formatting (dd/MM/yyyy)", () => {
  it("formats user input to dd/MM/yyyy while typing", () => {
    expect(formatDDMMYYYYInput("")).toBe("");
    expect(formatDDMMYYYYInput("2")).toBe("2");
    expect(formatDDMMYYYYInput("25")).toBe("25");
    expect(formatDDMMYYYYInput("250")).toBe("25/0");
    expect(formatDDMMYYYYInput("2502")).toBe("25/02");
    expect(formatDDMMYYYYInput("25022")).toBe("25/02/2");
    expect(formatDDMMYYYYInput("25022026")).toBe("25/02/2026");
    expect(formatDDMMYYYYInput("25-02-2026")).toBe("25/02/2026");
    expect(formatDDMMYYYYInput("25/2/2026")).toBe("25/02/2026");
    expect(formatDDMMYYYYInput("٢٥/٢/٢٠٢٦")).toBe("25/02/2026");
    expect(formatDDMMYYYYInput("25022026xxxx")).toBe("25/02/2026");
  });

  it("parses only valid dd/MM/yyyy dates", () => {
    const reference = new Date(2026, 0, 1);

    const valid = parseDDMMYYYY("25/02/2026", reference);
    expect(valid).toBeDefined();
    expect(format(valid!, DDMMYYYY_PATTERN)).toBe("25/02/2026");

    expect(parseDDMMYYYY("32/01/2026", reference)).toBeUndefined();
    expect(parseDDMMYYYY("29/02/2025", reference)).toBeUndefined();

    const leap = parseDDMMYYYY("29/02/2024", reference);
    expect(leap).toBeDefined();
    expect(format(leap!, DDMMYYYY_PATTERN)).toBe("29/02/2024");
  });
});
