import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const findUniqueMock = vi.fn();
const versionCountMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/db", () => ({
  db: {
    wikiPage: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
    wikiVersion: { count: (...args: unknown[]) => versionCountMock(...args) },
  },
}));

import { createWiki, deleteWiki, updateWiki } from "../src/app/(portal)/knowledge/wiki/actions";
import type { WikiFormData } from "@/types/knowledge";

const form: WikiFormData = {
  title: "Quy trình release",
  content: "<p>Bước 1</p>",
  category: "Process",
  project: "SBI Trading Platform",
  tags: "release, qa",
};

beforeEach(() => {
  authMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  findUniqueMock.mockReset();
  versionCountMock.mockReset();
  createMock.mockResolvedValue({ id: "w1" });
});

describe("createWiki", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(createWiki(form)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects required field gaps", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createWiki({ ...form, title: "  " })).rejects.toThrow("Validation");
    await expect(createWiki({ ...form, category: " " })).rejects.toThrow("Validation");
    await expect(createWiki({ ...form, content: "<p>&nbsp;</p>" })).rejects.toThrow("Validation");
  });

  it("creates v1, sanitizes content, sets project and author, redirects", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createWiki({ ...form, content: "<p>ok</p><script>alert(1)</script>" })).rejects.toThrow("REDIRECT:/knowledge/wiki/w1");
    const arg = createMock.mock.calls[0][0] as {
      data: { authorId: string; content: string; project: string; versions: { create: { version: number } } };
    };
    expect(arg.data.authorId).toBe("u3");
    expect(arg.data.project).toBe("SBI Trading Platform");
    expect(arg.data.content).not.toContain("script");
    expect(arg.data.versions.create.version).toBe(1);
  });
});

describe("updateWiki", () => {
  it("snapshots the next version number", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "w1" });
    versionCountMock.mockResolvedValue(2);
    await expect(updateWiki("w1", form)).rejects.toThrow("REDIRECT:/knowledge/wiki/w1");
    const arg = updateMock.mock.calls[0][0] as { data: { versions: { create: { version: number } } } };
    expect(arg.data.versions.create.version).toBe(3);
  });

  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(updateWiki("w1", form)).rejects.toThrow("Forbidden");
  });
});

describe("deleteWiki", () => {
  it("deletes for an editor and redirects to the list", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(deleteWiki("w1")).rejects.toThrow("REDIRECT:/knowledge/wiki");
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});
