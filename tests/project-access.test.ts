import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const projectFindUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/db", () => ({ db: { project: { findUnique: (...a: unknown[]) => projectFindUniqueMock(...a) } } }));

import { requireProjectEditAccess } from "../src/lib/project-access";

beforeEach(() => {
  authMock.mockReset();
  projectFindUniqueMock.mockReset();
});

describe("requireProjectEditAccess", () => {
  it("rejects when there's no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireProjectEditAccess("p1")).rejects.toThrow("Forbidden");
    expect(projectFindUniqueMock).not.toHaveBeenCalled();
  });

  it("allows any manager role without looking up the project", async () => {
    for (const role of ["ADMIN", "DIVISION_LEADER", "SECTION_MANAGER"]) {
      authMock.mockResolvedValue({ user: { id: "u1", role } });
      await expect(requireProjectEditAccess("p1")).resolves.toEqual({ id: "u1", role });
    }
    expect(projectFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects a MEMBER outright", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(requireProjectEditAccess("p1")).rejects.toThrow("Forbidden");
    expect(projectFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects a PM who is not one of the project's PIC PMs", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(requireProjectEditAccess("p1")).rejects.toThrow("Forbidden");
  });

  it("rejects a PM when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue(null);
    await expect(requireProjectEditAccess("p1")).rejects.toThrow("Forbidden");
  });

  it("allows a PM who is one of the (possibly several) PIC PMs", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "other" }, { id: "u3" }] });
    await expect(requireProjectEditAccess("p1")).resolves.toEqual({ id: "u3", role: "PM" });
  });
});
