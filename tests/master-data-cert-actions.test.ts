import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { certificateType: {
  create: (...a: unknown[]) => createMock(...a), update: vi.fn(), delete: vi.fn(),
} } }));

import { createCertType } from "../src/app/(portal)/master-data/certificates/actions";

beforeEach(() => { authMock.mockReset(); createMock.mockReset(); });

describe("certificate type actions auth", () => {
  it("blocks a PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "PM" } });
    await expect(createCertType({ name: "PMP", issuer: "PMI", category: "", active: true })).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("requires a name", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createCertType({ name: "  ", issuer: "", category: "", active: true })).rejects.toThrow(/name/i);
  });
  it("allows a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createCertType({ name: "PMP", issuer: "PMI", category: "", active: true });
    expect(createMock).toHaveBeenCalled();
  });
});
