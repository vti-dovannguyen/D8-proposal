import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { project: {
  create: (...a: unknown[]) => createMock(...a),
  update: (...a: unknown[]) => updateMock(...a),
  findUnique: (...a: unknown[]) => findUniqueMock(...a),
} } }));

import { createProject, updateProject, type ProjectFormData } from "../src/app/(portal)/projects/actions";

const base: ProjectFormData = {
  name: "P1", code: "", category: "Delivery", section: "D8.1", active: true, hasSubProjects: false, description: "",
  picPmIds: [], startDate: "", endDate: "", budgetedEffortMM: "",
  repoProvider: "", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "",
  allocations: [{ userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 8 }],
};

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); updateMock.mockReset(); findUniqueMock.mockReset(); });

describe("project actions allocations", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(createProject(base)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("createProject nests normalized allocations", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await createProject(base);
    const data = createMock.mock.calls[0][0].data as { allocations: { create: unknown[] } };
    expect(data.allocations.create).toEqual([{ userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 8, gitAccount: null, backlogAccount: null, twoFA: false, active: true }]);
  });
  it("updateProject replaces allocations with deleteMany + create", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProject("p1", base);
    const data = updateMock.mock.calls[0][0].data as { allocations: { deleteMany: unknown; create: unknown[] } };
    expect(data.allocations.deleteMany).toEqual({});
    expect(data.allocations.create).toEqual([{ userId: "u1", role: "Developer", skillId: "s1", hoursPerDay: 8, gitAccount: null, backlogAccount: null, twoFA: false, active: true }]);
  });
});

describe("project actions picPmIds (multi-select PIC PM)", () => {
  it("createProject connects each selected PIC PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await createProject({ ...base, picPmIds: ["pm1", "pm2"] });
    const data = createMock.mock.calls[0][0].data as { picPms: { connect: { id: string }[] } };
    expect(data.picPms.connect).toEqual([{ id: "pm1" }, { id: "pm2" }]);
  });
  it("createProject dedupes and drops blank ids", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await createProject({ ...base, picPmIds: ["pm1", "pm1", "", "  "] });
    const data = createMock.mock.calls[0][0].data as { picPms: { connect: { id: string }[] } };
    expect(data.picPms.connect).toEqual([{ id: "pm1" }]);
  });
  it("updateProject replaces PIC PMs with set (not connect)", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProject("p1", { ...base, picPmIds: ["pm2"] });
    const data = updateMock.mock.calls[0][0].data as { picPms: { set: { id: string }[] } };
    expect(data.picPms.set).toEqual([{ id: "pm2" }]);
  });
  it("updateProject clears all PIC PMs when picPmIds is empty", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProject("p1", { ...base, picPmIds: [] });
    const data = updateMock.mock.calls[0][0].data as { picPms: { set: { id: string }[] } };
    expect(data.picPms.set).toEqual([]);
  });
});

describe("updateProject PIC PM edit access", () => {
  it("allows a PM to update a project they are PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ picPms: [{ id: "u3" }] });
    await updateProject("p1", base);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("rejects a PM updating a project they are not PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(updateProject("p1", base)).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

import { updateProjectIntegration } from "../src/app/(portal)/projects/actions";

describe("updateProjectIntegration", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(updateProjectIntegration("p1", { repoProvider: "", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "" })).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("only sets accessKey when non-empty", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } });
    await updateProjectIntegration("p1", { repoProvider: "github", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "" });
    expect("accessKey" in (updateMock.mock.calls[0][0].data as object)).toBe(false);
    updateMock.mockReset();
    await updateProjectIntegration("p1", { repoProvider: "github", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "tok" });
    expect((updateMock.mock.calls[0][0].data as { accessKey?: string }).accessKey).toBe("tok");
  });
  it("allows a PM to update integration info for a project they are PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ picPms: [{ id: "u3" }] });
    await updateProjectIntegration("p1", { repoProvider: "github", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "" });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("rejects a PM updating integration info for a project they are not PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(
      updateProjectIntegration("p1", { repoProvider: "github", repoUrl: "", pmTool: "", pmUrl: "", accessKey: "" }),
    ).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
});
