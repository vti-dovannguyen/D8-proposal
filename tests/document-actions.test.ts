import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const findUniqueMock = vi.fn();
const uploadMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/storage", () => ({
  uploadDocumentFile: (...args: unknown[]) => uploadMock(...args),
  getSignedUrl: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    document: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { createDocument, deleteDocument, uploadNewVersion } from "../src/app/(portal)/knowledge/documents/actions";

function form(fields: Record<string, string>, file?: File): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  if (file) fd.set("file", file);
  return fd;
}

const pdf = () => new File([new Uint8Array([1, 2, 3])], "report.pdf", { type: "application/pdf" });

beforeEach(() => {
  authMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  findUniqueMock.mockReset();
  uploadMock.mockReset();
  uploadMock.mockResolvedValue({ mimeType: "application/pdf" });
  createMock.mockResolvedValue({ id: "d1" });
});

describe("createDocument", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(createDocument(form({ title: "T", category: "Proposal" }, pdf()))).rejects.toThrow("Forbidden");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(createDocument(form({ title: "T", category: "Proposal" }, pdf()))).rejects.toThrow("Forbidden");
  });

  it("rejects a blank title", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createDocument(form({ title: "  ", category: "Proposal" }, pdf()))).rejects.toThrow("Validation");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects a missing file", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createDocument(form({ title: "T", category: "Proposal" }))).rejects.toThrow("Validation");
  });

  it("rejects a blank category", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createDocument(form({ title: "T", category: "  " }, pdf()))).rejects.toThrow("Validation");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("creates for a PM, stores the object path, project, author, version 1, redirects", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createDocument(form({ title: "Sổ tay", category: "Proposal", project: "SBI Trading Platform", tags: "qa, qa, release" }, pdf()))).rejects.toThrow(
      "REDIRECT:/knowledge/documents/d1",
    );
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: { authorId: string; version: number; fileUrl: string; mimeType: string; project: string } };
    expect(arg.data.authorId).toBe("u3");
    expect(arg.data.project).toBe("SBI Trading Platform");
    expect(arg.data.version).toBe(1);
    expect(arg.data.mimeType).toBe("application/pdf");
    expect(arg.data.fileUrl.startsWith("documents/")).toBe(true);
  });
});

describe("uploadNewVersion", () => {
  it("increments version and replaces the file", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "d1", version: 1 });
    await expect(uploadNewVersion("d1", form({}, pdf()))).rejects.toThrow("REDIRECT:/knowledge/documents/d1");
    const arg = updateMock.mock.calls[0][0] as { data: { version: { increment: number } } };
    expect(arg.data.version).toEqual({ increment: 1 });
  });

  it("rejects a missing file", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "d1", version: 1 });
    await expect(uploadNewVersion("d1", form({}))).rejects.toThrow("Validation");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(uploadNewVersion("d1", form({}, pdf()))).rejects.toThrow("Forbidden");
  });
});

describe("deleteDocument", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(deleteDocument("d1")).rejects.toThrow("Forbidden");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes for an editor and redirects to the list", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(deleteDocument("d1")).rejects.toThrow("REDIRECT:/knowledge/documents");
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});
