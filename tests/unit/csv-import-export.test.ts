import { describe, it, expect } from "vitest";
import { escapeCsvField, toCsvRows } from "@/server/services/export.service";
import { parseCsvString } from "@/server/services/import.service";

describe("Phase 9 RFC-4180 CSV Import/Export Engine", () => {
  it("escapes CSV fields with commas, quotes, and newlines properly", () => {
    expect(escapeCsvField("simple")).toBe("simple");
    expect(escapeCsvField("with, comma")).toBe('"with, comma"');
    expect(escapeCsvField('with "quotes"')).toBe('"with ""quotes"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("serializes tabular data into RFC-4180 CRLF lines", () => {
    const headers = ["name", "email", "bio"];
    const rows = [
      { name: "Alice", email: "alice@example.com", bio: "Hacker, Builder" },
      { name: 'Bob "The Dev"', email: "bob@example.com", bio: "Rustacean" },
    ];

    const csv = toCsvRows(headers, rows);
    expect(csv).toContain("name,email,bio\r\n");
    expect(csv).toContain('Alice,alice@example.com,"Hacker, Builder"');
    expect(csv).toContain('"Bob ""The Dev""",bob@example.com,Rustacean');
  });

  it("parses CSV strings with quoted fields, internal quotes, and line breaks", () => {
    const rawCsv = `name,email,bio\r\nAlice,alice@example.com,"Hacker, Builder"\r\n"Bob ""The Dev""",bob@example.com,"Line 1\nLine 2"`;

    const records = parseCsvString(rawCsv);
    expect(records.length).toBe(2);

    expect(records[0]?.name).toBe("Alice");
    expect(records[0]?.email).toBe("alice@example.com");
    expect(records[0]?.bio).toBe("Hacker, Builder");

    expect(records[1]?.name).toBe('Bob "The Dev"');
    expect(records[1]?.email).toBe("bob@example.com");
    expect(records[1]?.bio).toBe("Line 1\nLine 2");
  });

  it("handles UTF-8 Byte Order Mark (BOM) gracefully", () => {
    const withBom = "\uFEFFname,email\r\nAlice,alice@example.com";
    const records = parseCsvString(withBom);

    expect(records.length).toBe(1);
    expect(records[0]?.name).toBe("Alice");
    expect(records[0]?.email).toBe("alice@example.com");
  });

  it("handles empty input and whitespace-only CSV", () => {
    expect(parseCsvString("")).toEqual([]);
    expect(parseCsvString("   \n\r  ")).toEqual([]);
  });
});
