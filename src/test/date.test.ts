import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { DDMMYYYY_PATTERN, formatDDMMYYYYInput, parseDDMMYYYY } from "../lib/date";

describe("date formatting (dd/MM/yyyy)", () => {
  it("formats user input to dd/MM/yyyy while typing", () => {
    expect(formatDDMMYYYYInput("")).toBe("");
    expect(formatDDMMYYYYInput("1")).toBe("1");
    expect(formatDDMMYYYYInput("12")).toBe("12");
    expect(formatDDMMYYYYInput("123")).toBe("12/3");
    expect(formatDDMMYYYYInput("1234")).toBe("12/34");
    expect(formatDDMMYYYYInput("12345")).toBe("12/34/5");
    expect(formatDDMMYYYYInput("12/03/2026")).toBe("12/03/2026");
    expect(formatDDMMYYYYInput("12-03-2026")).toBe("12/03/2026");
    expect(formatDDMMYYYYInput("12032026xxxx")).toBe("12/03/2026");
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

