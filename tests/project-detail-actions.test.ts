import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const envCreate = vi.fn(), envUpdate = vi.fn(), envDelete = vi.fn();
const allocCreate = vi.fn(), allocDelete = vi.fn();
const kpiCreateMany = vi.fn(), kpiUpdate = vi.fn(), kpiDelete = vi.fn();
const projectFindUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  projectEnvironment: { create: (...a: unknown[]) => envCreate(...a), update: (...a: unknown[]) => envUpdate(...a), delete: (...a: unknown[]) => envDelete(...a) },
  projectAllocation: { create: (...a: unknown[]) => allocCreate(...a), update: vi.fn(), delete: (...a: unknown[]) => allocDelete(...a) },
  projectKpi: {
    createMany: (...a: unknown[]) => kpiCreateMany(...a),
    update: (...a: unknown[]) => kpiUpdate(...a),
    delete: (...a: unknown[]) => kpiDelete(...a),
  },
  project: { findUnique: (...a: unknown[]) => projectFindUniqueMock(...a) },
} }));

import { createEnvironment, updateEnvironment, deleteEnvironment, addAllocation, addProjectKpis, updateProjectKpiNote, deleteProjectKpi } from "../src/app/(portal)/projects/[id]/actions";

const env = { name: "Dev", url: "", username: "", password: "", note: "", status: "ACTIVE" };

beforeEach(() => {
  authMock.mockReset(); envCreate.mockReset(); envUpdate.mockReset(); envDelete.mockReset();
  allocCreate.mockReset(); allocDelete.mockReset(); projectFindUniqueMock.mockReset();
  kpiCreateMany.mockReset(); kpiUpdate.mockReset(); kpiDelete.mockReset();
});

describe("detail-page actions auth", () => {
  it("blocks a MEMBER from creating an environment", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(createEnvironment("p1", env)).rejects.toThrow("Forbidden");
    expect(envCreate).not.toHaveBeenCalled();
  });
  it("requires an environment name", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(createEnvironment("p1", { ...env, name: "  " })).rejects.toThrow(/tên/i);
  });
  it("updateEnvironment omits password when empty (keep existing)", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateEnvironment("e1", "p1", { ...env, password: "" });
    const data = envUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect("password" in data).toBe(false);
  });
  it("updateEnvironment sets password when provided", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateEnvironment("e1", "p1", { ...env, password: "secret" });
    const data = envUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.password).toBe("secret");
  });
  it("blocks a MEMBER from adding an allocation", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(addAllocation("p1", { userId: "u1", role: "Dev", skillId: "", hoursPerDay: 8 })).rejects.toThrow("Forbidden");
    expect(allocCreate).not.toHaveBeenCalled();
  });
  it("addAllocation creates a normalized row for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await addAllocation("p1", { userId: "u1", role: "Dev", skillId: "", hoursPerDay: 8 });
    expect(allocCreate).toHaveBeenCalledWith({ data: { projectId: "p1", userId: "u1", role: "Dev", skillId: null, hoursPerDay: 8, gitAccount: null, backlogAccount: null, twoFA: false, active: true } });
  });
  it("allows a manager to delete an environment", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await deleteEnvironment("e1", "p1");
    expect(envDelete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
  it("allows a PM who is PIC PM on the project to create an environment", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "u3" }] });
    await createEnvironment("p1", env);
    expect(envCreate).toHaveBeenCalledTimes(1);
  });
  it("rejects a PM who is not PIC PM on the project from creating an environment", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(createEnvironment("p1", env)).rejects.toThrow("Forbidden");
    expect(envCreate).not.toHaveBeenCalled();
  });
});

describe("KPI loại A actions", () => {
  const input = { month: "2026-08", entries: [{ userId: "u1", note: "" }, { userId: "u2", note: "tốt" }] };

  it("blocks a MEMBER from adding KPI", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(addProjectKpis("p1", input)).rejects.toThrow("Forbidden");
    expect(kpiCreateMany).not.toHaveBeenCalled();
  });
  it("adds every selected member for the month, skipping duplicates", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await addProjectKpis("p1", input);
    expect(kpiCreateMany).toHaveBeenCalledWith({
      data: [
        { projectId: "p1", month: "2026-08", kpiType: "A", userId: "u1", note: null },
        { projectId: "p1", month: "2026-08", kpiType: "A", userId: "u2", note: "tốt" },
      ],
      skipDuplicates: true,
    });
  });
  it("rejects an invalid month before touching the DB", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await expect(addProjectKpis("p1", { month: "08-2026", entries: [{ userId: "u1" }] })).rejects.toThrow(/tháng/i);
    expect(kpiCreateMany).not.toHaveBeenCalled();
  });
  it("lets a PIC PM add KPI on their own project", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "u3" }] });
    await addProjectKpis("p1", input);
    expect(kpiCreateMany).toHaveBeenCalledTimes(1);
  });
  it("rejects a PM who is not PIC PM on the project", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(addProjectKpis("p1", input)).rejects.toThrow("Forbidden");
    expect(kpiCreateMany).not.toHaveBeenCalled();
  });
  it("stores a blank note as null", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProjectKpiNote("k1", "p1", "   ");
    expect(kpiUpdate).toHaveBeenCalledWith({ where: { id: "k1" }, data: { note: null } });
  });
  it("deletes a KPI row for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await deleteProjectKpi("k1", "p1");
    expect(kpiDelete).toHaveBeenCalledWith({ where: { id: "k1" } });
  });
  it("blocks a MEMBER from deleting a KPI row", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(deleteProjectKpi("k1", "p1")).rejects.toThrow("Forbidden");
    expect(kpiDelete).not.toHaveBeenCalled();
  });
});
