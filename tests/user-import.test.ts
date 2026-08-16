import { describe, it, expect } from "vitest";
import { normalizeUserImportRows } from "@/lib/user-import";

const D = "vti.com.vn";

describe("normalizeUserImportRows", () => {
  it("builds email from account + domain and trims/lowercases", () => {
    const { rows } = normalizeUserImportRows([{ Name: "Bùi Hữu Lợi", Account: " Loi.BuiHuu " }], D);
    expect(rows[0]).toMatchObject({ email: "loi.buihuu@vti.com.vn", name: "Bùi Hữu Lợi" });
  });
  it("uses an account that already contains @ as-is", () => {
    const { rows } = normalizeUserImportRows([{ Name: "X", Account: "x@other.com" }], D);
    expect(rows[0].email).toBe("x@other.com");
  });
  it("skips rows missing Name or Account with an error note", () => {
    const { rows, errors } = normalizeUserImportRows(
      [{ Name: "", Account: "a.b" }, { Name: "Y", Account: "" }, { Name: "Z", Account: "z.z" }],
      D,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("z.z@vti.com.vn");
    expect(errors).toHaveLength(2);
  });
  it("normalizes gender case-insensitively, junk -> null", () => {
    const { rows } = normalizeUserImportRows(
      [{ Name: "A", Account: "a", Gender: "male" }, { Name: "B", Account: "b", Gender: "FEMALE" }, { Name: "C", Account: "c", Gender: "x" }],
      D,
    );
    expect(rows.map((r) => r.gender)).toEqual(["Male", "Female", null]);
  });
  it("passes a Date through, parses a date string, junk -> null", () => {
    const d = new Date("1995-03-02");
    const { rows } = normalizeUserImportRows(
      [{ Name: "A", Account: "a", "Date of Birth": d },
       { Name: "B", Account: "b", "Date of Birth": "1990-01-15" },
       { Name: "C", Account: "c", "Date of Birth": "not-a-date" }],
      D,
    );
    expect(rows[0].dateOfBirth).toEqual(d);
    expect(rows[1].dateOfBirth?.getUTCFullYear()).toBe(1990);
    expect(rows[2].dateOfBirth).toBeNull();
  });
  it("de-duplicates by email within the file (last wins) and notes it", () => {
    const { rows, errors } = normalizeUserImportRows(
      [{ Name: "First", Account: "dup" }, { Name: "Second", Account: "dup" }],
      D,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Second");
    expect(errors.some((e) => /dup@vti\.com\.vn/.test(e))).toBe(true);
  });
});
