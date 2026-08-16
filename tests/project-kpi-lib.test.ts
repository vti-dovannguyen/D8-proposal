import { describe, it, expect } from "vitest";
import { normalizeKpiInput, distinctMonths, sortKpiRows, buildKpiExportAoa, kpiExportFileName, KPI_EXPORT_HEADERS, KPI_TYPE_A } from "@/lib/project-kpi";

const entry = (userId: string, note?: string) => ({ userId, note });

describe("normalizeKpiInput()", () => {
  it("keeps a valid month and defaults kpiType to A", () => {
    const out = normalizeKpiInput({ month: "2026-08", entries: [entry("u1")] });
    expect(out.month).toBe("2026-08");
    expect(out.kpiType).toBe(KPI_TYPE_A);
  });
  it("rejects a malformed month", () => {
    expect(() => normalizeKpiInput({ month: "2026-8", entries: [entry("u1")] })).toThrow(/tháng/i);
    expect(() => normalizeKpiInput({ month: "", entries: [entry("u1")] })).toThrow(/tháng/i);
  });
  it("rejects an unknown kpiType", () => {
    expect(() => normalizeKpiInput({ month: "2026-08", kpiType: "B", entries: [entry("u1")] })).toThrow(/loại KPI/i);
  });
  it("requires at least one member", () => {
    expect(() => normalizeKpiInput({ month: "2026-08", entries: [] })).toThrow(/ít nhất 1 member/i);
    expect(() => normalizeKpiInput({ month: "2026-08", entries: [entry("  ")] })).toThrow(/ít nhất 1 member/i);
  });
  it("accepts several members in one month", () => {
    const out = normalizeKpiInput({ month: "2026-08", entries: [entry("u1"), entry("u2"), entry("u3")] });
    expect(out.entries.map((e) => e.userId)).toEqual(["u1", "u2", "u3"]);
  });
  it("blanks an empty note to null and trims a real one", () => {
    const out = normalizeKpiInput({ month: "2026-08", entries: [entry("u1", "   "), entry("u2", "  tốt  ")] });
    expect(out.entries).toEqual([{ userId: "u1", note: null }, { userId: "u2", note: "tốt" }]);
  });
  it("de-dups a member listed twice, keeping the note", () => {
    const out = normalizeKpiInput({ month: "2026-08", entries: [entry("u1"), entry("u1", "vượt target")] });
    expect(out.entries).toEqual([{ userId: "u1", note: "vượt target" }]);
  });
});

describe("distinctMonths()", () => {
  it("de-dups and sorts newest first", () => {
    expect(distinctMonths([{ month: "2026-07" }, { month: "2026-09" }, { month: "2026-07" }]))
      .toEqual(["2026-09", "2026-07"]);
  });
  it("returns an empty list for no rows", () => {
    expect(distinctMonths([])).toEqual([]);
  });
});

describe("buildKpiExportAoa()", () => {
  const rows = [
    { month: "2026-08", projectName: "Alpha", userName: "An", note: "vượt target" },
    { month: "2026-08", projectName: "Beta", userName: "Binh", note: null },
  ];

  it("starts with the header row", () => {
    expect(buildKpiExportAoa(rows)[0]).toEqual([...KPI_EXPORT_HEADERS]);
  });
  it("emits one row per KPI with the type column filled in", () => {
    const aoa = buildKpiExportAoa(rows);
    expect(aoa).toHaveLength(3);
    expect(aoa[1]).toEqual(["2026-08", "Alpha", "An", KPI_TYPE_A, "vượt target"]);
  });
  it("writes an empty cell for a missing note (not the string 'null')", () => {
    expect(buildKpiExportAoa(rows)[2][4]).toBe("");
  });
  it("returns just the header for no rows", () => {
    expect(buildKpiExportAoa([])).toEqual([[...KPI_EXPORT_HEADERS]]);
  });
});

describe("kpiExportFileName()", () => {
  it("scopes the name to the filtered month", () => {
    expect(kpiExportFileName("2026-08")).toBe("KPI-loai-A-2026-08.xlsx");
  });
  it("falls back when no month filter is set or it is malformed", () => {
    expect(kpiExportFileName()).toBe("KPI-loai-A-tat-ca-thang.xlsx");
    expect(kpiExportFileName("08-2026")).toBe("KPI-loai-A-tat-ca-thang.xlsx");
  });
  it("stays ASCII so Content-Disposition needs no encoding", () => {
    expect(kpiExportFileName("2026-08")).toMatch(/^[\x20-\x7E]+$/);
  });
});

describe("sortKpiRows()", () => {
  it("orders by month desc, then project, then member", () => {
    const rows = [
      { month: "2026-07", projectName: "Beta", userName: "An" },
      { month: "2026-08", projectName: "Beta", userName: "Zung" },
      { month: "2026-08", projectName: "Alpha", userName: "Binh" },
      { month: "2026-08", projectName: "Beta", userName: "An" },
    ];
    expect(sortKpiRows(rows).map((r) => `${r.month}/${r.projectName}/${r.userName}`)).toEqual([
      "2026-08/Alpha/Binh",
      "2026-08/Beta/An",
      "2026-08/Beta/Zung",
      "2026-07/Beta/An",
    ]);
  });
  it("does not mutate the input", () => {
    const rows = [{ month: "2026-07", userName: "B" }, { month: "2026-08", userName: "A" }];
    sortKpiRows(rows);
    expect(rows[0].month).toBe("2026-07");
  });
});
