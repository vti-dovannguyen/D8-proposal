import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const mdCreate = vi.fn(), mdUpdate = vi.fn(), mdDelete = vi.fn(), mdUpsert = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  projectMonthlyDetail: {
    create: (...a: unknown[]) => mdCreate(...a),
    update: (...a: unknown[]) => mdUpdate(...a),
    delete: (...a: unknown[]) => mdDelete(...a),
    upsert: (...a: unknown[]) => mdUpsert(...a),
  },
} }));

import {
  addMonthlyDetail, updateMonthlyDetail, deleteMonthlyDetail, importMonthlyDetails,
  type MonthlyFormData,
} from "../src/app/(portal)/projects/[id]/actions";

const form = (o: Partial<MonthlyFormData> = {}): MonthlyFormData => ({
  month: "2026-01", billableProject: 5, billableDevelop: 0, warrantyEffort: 0,
  calendarMember: 10, calendarIntern: 0, calendarCollaborator: 0,
  otMemberEffort: 0, otInternEffort: 0, otCollaboratorEffort: 0, absent: 0, eeToMonth: 0, ...o,
});

beforeEach(() => { authMock.mockReset(); mdCreate.mockReset(); mdUpdate.mockReset(); mdDelete.mockReset(); mdUpsert.mockReset(); });

describe("monthly-detail actions auth", () => {
  it("blocks a MEMBER from adding a row", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(addMonthlyDetail("p1", form())).rejects.toThrow("Forbidden");
    expect(mdCreate).not.toHaveBeenCalled();
  });
  it("blocks a MEMBER from importing", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(importMonthlyDetails("p1", "2026-01\t5")).rejects.toThrow("Forbidden");
  });
});

describe("addMonthlyDetail", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("rejects an invalid month", async () => {
    await expect(addMonthlyDetail("p1", form({ month: "2026/01" }))).rejects.toThrow(/tháng/i);
    expect(mdCreate).not.toHaveBeenCalled();
  });
  it("rejects a negative value", async () => {
    await expect(addMonthlyDetail("p1", form({ calendarMember: -1 }))).rejects.toThrow(/giá trị/i);
  });
  it("creates a row with projectId and coerced fields", async () => {
    await addMonthlyDetail("p1", form());
    expect(mdCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ projectId: "p1", month: "2026-01", billableProject: 5, calendarMember: 10, eeToMonth: 0 }) });
  });
});

describe("updateMonthlyDetail / deleteMonthlyDetail", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("updates by id", async () => {
    await updateMonthlyDetail("m1", "p1", form({ billableProject: 7 }));
    expect(mdUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: expect.objectContaining({ billableProject: 7 }) });
  });
  it("deletes by id", async () => {
    await deleteMonthlyDetail("m1", "p1");
    expect(mdDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});

describe("importMonthlyDetails", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("upserts each valid row by [projectId, month] and returns counts + errors", async () => {
    const text = [
      ["2026-01", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 50, 40].join("\t"),
      ["2026/02", 5, 0, 0, 10, 0, 0, 0, 0, 0, 0, 50, 40].join("\t"),
    ].join("\n");
    const res = await importMonthlyDetails("p1", text);
    expect(res.imported).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(mdUpsert).toHaveBeenCalledTimes(1);
    expect(mdUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_month: { projectId: "p1", month: "2026-01" } },
    }));
  });
});
