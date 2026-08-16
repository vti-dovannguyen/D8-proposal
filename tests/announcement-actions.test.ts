import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/db", () => ({
  db: {
    announcement: {
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      delete: (...a: unknown[]) => deleteMock(...a),
    },
  },
}));

import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from "../src/app/(portal)/announcements/actions";
import type { AnnouncementFormData } from "@/types/community";

const valid: AnnouncementFormData = { title: "Nghỉ lễ", body: "<p>Công ty nghỉ 2 ngày</p>", pinned: true, active: true };

beforeEach(() => {
  authMock.mockReset(); createMock.mockReset(); updateMock.mockReset(); deleteMock.mockReset();
  createMock.mockResolvedValue({ id: "a1" });
});

describe("createAnnouncement", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(createAnnouncement(valid)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects a PM (managers only)", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createAnnouncement(valid)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects a blank title or empty body", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await expect(createAnnouncement({ ...valid, title: " " })).rejects.toThrow("Validation");
    await expect(createAnnouncement({ ...valid, body: "<p>   </p>" })).rejects.toThrow("Validation");
  });
  it("sanitizes the body and persists active + pinned for a manager, then redirects", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    const dirty = { ...valid, body: '<p>Hi</p><script>alert(1)</script>', active: false };
    await expect(createAnnouncement(dirty)).rejects.toThrow("REDIRECT:/announcements");
    const arg = createMock.mock.calls[0][0] as { data: { authorId: string; pinned: boolean; active: boolean; body: string } };
    expect(arg.data).toMatchObject({ authorId: "u1", pinned: true, active: false });
    expect(arg.data.body).not.toContain("<script>");
    expect(arg.data.body).toContain("Hi");
  });
});

describe("updateAnnouncement / deleteAnnouncement", () => {
  it("updates for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(updateAnnouncement("a1", valid)).rejects.toThrow("REDIRECT:/announcements");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("rejects update for a PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(updateAnnouncement("a1", valid)).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("rejects delete for a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(deleteAnnouncement("a1")).rejects.toThrow("Forbidden");
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("deletes for a manager and redirects", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "DIVISION_LEADER" } });
    await expect(deleteAnnouncement("a1")).rejects.toThrow("REDIRECT:/announcements");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "a1" } });
  });
});
