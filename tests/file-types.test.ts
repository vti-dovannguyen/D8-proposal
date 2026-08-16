import { describe, it, expect } from "vitest";
import { fileTypeMeta } from "@/lib/file-types";

describe("fileTypeMeta()", () => {
  it("maps common extensions to keys", () => {
    expect(fileTypeMeta("report.pdf").key).toBe("pdf");
    expect(fileTypeMeta("data.xlsx").key).toBe("xls");
    expect(fileTypeMeta("old.xls").key).toBe("xls");
    expect(fileTypeMeta("plan.docx").key).toBe("doc");
    expect(fileTypeMeta("deck.pptx").key).toBe("ppt");
    expect(fileTypeMeta("notes.md").key).toBe("md");
    expect(fileTypeMeta("readme.txt").key).toBe("txt");
    expect(fileTypeMeta("rows.csv").key).toBe("csv");
    expect(fileTypeMeta("bundle.zip").key).toBe("zip");
    expect(fileTypeMeta("photo.PNG").key).toBe("image");
  });
  it("is case-insensitive and uses the last dotted segment", () => {
    expect(fileTypeMeta("ARCHIVE.final.PDF").key).toBe("pdf");
    expect(fileTypeMeta("a.b.c.docx").key).toBe("doc");
  });
  it("falls back to 'file' for unknown or missing extensions", () => {
    expect(fileTypeMeta("noext").key).toBe("file");
    expect(fileTypeMeta("weird.xyz").key).toBe("file");
    expect(fileTypeMeta("").key).toBe("file");
  });
  it("sets label to the uppercased extension or FILE", () => {
    expect(fileTypeMeta("report.pdf").label).toBe("PDF");
    expect(fileTypeMeta("noext").label).toBe("FILE");
  });
  it("returns a tailwind tone string", () => {
    expect(fileTypeMeta("report.pdf").tone).toMatch(/bg-.*text-/);
  });
});
