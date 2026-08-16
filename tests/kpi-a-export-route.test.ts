import { describe, it, expect, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";

const authMock = vi.fn();
const kpiFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/db", () => ({ db: { projectKpi: { findMany: (...a: unknown[]) => kpiFindMany(...a) } } }));

import { GET } from "../src/app/api/kpi-a/export/route";

const kpi = (month: string, projectName: string, userName: string, note: string | null = null) => ({
  id: `${month}-${userName}`, month, note,
  project: { id: `p-${projectName}`, name: projectName },
  user: { name: userName },
});

beforeEach(() => {
  authMock.mockReset();
  kpiFindMany.mockReset();
  kpiFindMany.mockResolvedValue([kpi("2026-08", "Alpha", "An", "tốt"), kpi("2026-07", "Beta", "Binh")]);
});

const req = (query = "") => new Request(`http://localhost/api/kpi-a/export${query}`);

/** Read the response body back through SheetJS so we assert on real cells. */
async function sheetRows(res: Response): Promise<unknown[][]> {
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
}

describe("GET /api/kpi-a/export", () => {
  it("rejects an anonymous request", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    expect(kpiFindMany).not.toHaveBeenCalled();
  });

  it("rejects a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    expect((await GET(req())).status).toBe(403);
    expect(kpiFindMany).not.toHaveBeenCalled();
  });

  it("returns an xlsx attachment for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    const res = await GET(req("?month=2026-08"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="KPI-loai-A-2026-08.xlsx"');
  });

  it("writes the header and one row per KPI, sorted newest month first", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    const rows = await sheetRows(await GET(req()));
    expect(rows[0]).toEqual(["Tháng", "Dự án", "Member", "Loại KPI", "Ghi chú"]);
    expect(rows[1]).toEqual(["2026-08", "Alpha", "An", "A", "tốt"]);
    expect(rows[2]?.slice(0, 4)).toEqual(["2026-07", "Beta", "Binh", "A"]);
  });

  it("still produces a header-only file when nothing matches", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    kpiFindMany.mockResolvedValue([]);
    const rows = await sheetRows(await GET(req("?month=2026-01")));
    expect(rows).toEqual([["Tháng", "Dự án", "Member", "Loại KPI", "Ghi chú"]]);
  });

  it("passes the month and project filters into the query", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await GET(req("?month=2026-08&projectId=p1"));
    expect(kpiFindMany.mock.calls[0][0].where).toMatchObject({ month: "2026-08", projectId: "p1", kpiType: "A" });
  });

  it("ignores a malformed month instead of erroring", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    const res = await GET(req("?month=08-2026"));
    expect(res.status).toBe(200);
    expect("month" in kpiFindMany.mock.calls[0][0].where).toBe(false);
    expect(res.headers.get("Content-Disposition")).toContain("tat-ca-thang");
  });

  it("scopes a PM to the projects they are PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "pm1", role: "PM" } });
    await GET(req());
    expect(kpiFindMany.mock.calls[0][0].where.project).toEqual({ picPms: { some: { id: "pm1" } } });
  });

  it("does not scope a manager to specific projects, and does not filter on active", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "SECTION_MANAGER" } });
    await GET(req());
    expect(kpiFindMany.mock.calls[0][0].where.project).toEqual({});
  });
});
