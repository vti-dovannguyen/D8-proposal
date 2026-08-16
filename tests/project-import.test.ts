import { describe, it, expect } from "vitest";
import { normalizeProjectImportRows } from "@/lib/project-import";

describe("normalizeProjectImportRows", () => {
  it("maps Name/Project Code/Department/Status/Budgeted Effort", () => {
    const { rows } = normalizeProjectImportRows([
      {
        Name: "ID_CPAD Rebuild",
        "Project Code": "ID_CPAD Rebuild",
        Department: "VTI.D8",
        "Start Date": 46223,
        "End Date": 46386,
        "Project Manager/Display Name": "Nguyễn Văn Vương (VTI.D8) <vuong.nguyenvan1@vti.com.vn>",
        "Project Manager/Display Name_1": "Nguyễn Văn Vương (VTI.D8)",
        Status: "Open",
        "Budgeted Effort (MM)": 19.1,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "ID_CPAD Rebuild",
      code: "ID_CPAD Rebuild",
      section: "VTI.D8",
      active: true,
      budgetedEffortMM: 19.1,
      picPmEmail: "vuong.nguyenvan1@vti.com.vn",
      picPmName: "Nguyễn Văn Vương",
    });
    expect(rows[0].startDate?.toISOString().slice(0, 10)).toBe("2026-07-20");
    expect(rows[0].endDate?.toISOString().slice(0, 10)).toBe("2026-12-30");
  });

  it("maps a non-Open status to inactive", () => {
    const { rows } = normalizeProjectImportRows([{ Name: "X", Status: "Closed" }]);
    expect(rows[0].active).toBe(false);
  });

  it("skips rows missing Name", () => {
    const { rows, errors } = normalizeProjectImportRows([{ Name: "" }, { Name: "Y" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Y");
    expect(errors).toHaveLength(1);
  });

  it("rejects a row where Start Date is not before End Date", () => {
    const { rows, errors } = normalizeProjectImportRows([
      { Name: "Bad", "Start Date": "2026-05-01", "End Date": "2026-01-01" },
    ]);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/Bad/);
  });

  it("returns null picPm fields when the PM column is blank", () => {
    const { rows } = normalizeProjectImportRows([{ Name: "NoPm" }]);
    expect(rows[0].picPmEmail).toBeNull();
    expect(rows[0].picPmName).toBeNull();
  });
});
