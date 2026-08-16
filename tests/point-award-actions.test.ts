import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const userFindMock = vi.fn();
const projectFindMock = vi.fn();
const sendCardMock = vi.fn();
const uploadMock = vi.fn();
const signMock = vi.fn();
const removeMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/google-chat", () => ({ sendPointAwardCard: (...a: unknown[]) => sendCardMock(...a) }));
vi.mock("@/lib/storage", () => ({
  uploadDocumentFile: (...a: unknown[]) => uploadMock(...a),
  getSignedUrl: (...a: unknown[]) => signMock(...a),
  removeFromBucket: (...a: unknown[]) => removeMock(...a),
}));
vi.mock("@/lib/db", () => ({ db: {
  pointAward: {
    upsert: (...a: unknown[]) => upsertMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
    findUnique: (...a: unknown[]) => findUniqueMock(...a),
  },
  user: { findUnique: (...a: unknown[]) => userFindMock(...a) },
  project: { findUnique: (...a: unknown[]) => projectFindMock(...a) },
} }));

import { createPointAward, deletePointAward } from "../src/app/(portal)/point-award/actions";

const baseInput = {
  month: "2026-06", type: "PERSON" as const, userId: "user2",
  points: 85, reason: "Tốt", sendNotification: false,
};

const fakeImage = () => new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });

beforeEach(() => {
  authMock.mockReset(); upsertMock.mockReset(); updateMock.mockReset();
  deleteMock.mockReset(); userFindMock.mockReset(); projectFindMock.mockReset(); sendCardMock.mockReset();
  uploadMock.mockReset(); signMock.mockReset(); removeMock.mockReset(); findUniqueMock.mockReset();
  upsertMock.mockResolvedValue({ id: "pa1" });
  userFindMock.mockResolvedValue({ name: "Nguyễn Văn A" });
  projectFindMock.mockResolvedValue({ name: "Dự án X" });
  signMock.mockResolvedValue("https://signed.example/photo.png");
  findUniqueMock.mockResolvedValue({ imageUrl: null });
});

describe("createPointAward", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(createPointAward(baseInput)).rejects.toThrow("Forbidden");
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("rejects out-of-range points", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createPointAward({ ...baseInput, points: 101 })).rejects.toThrow(/point/i);
  });
  it("rejects an empty reason", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createPointAward({ ...baseInput, reason: "   " })).rejects.toThrow(/lý do/i);
  });
  it("requires a person when type is PERSON", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await expect(createPointAward({ ...baseInput, userId: "" })).rejects.toThrow(/cá nhân/i);
  });
  it("upserts on (month, userId) and skips notification when flag is off", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createPointAward(baseInput);
    const arg = upsertMock.mock.calls[0][0] as { where: unknown; create: { userId: string | null; projectId: string | null } };
    expect(arg.where).toEqual({ month_userId: { month: "2026-06", userId: "user2" } });
    expect(arg.create.userId).toBe("user2");
    expect(arg.create.projectId).toBeNull();
    expect(sendCardMock).not.toHaveBeenCalled();
  });
  it("upserts on (month, projectId) for a PROJECT award", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createPointAward({ month: "2026-06", type: "PROJECT", projectId: "proj9", points: 30, reason: "OK", sendNotification: false });
    const arg = upsertMock.mock.calls[0][0] as { where: unknown };
    expect(arg.where).toEqual({ month_projectId: { month: "2026-06", projectId: "proj9" } });
  });
  it("sends a notification and marks notified when the flag is on and send succeeds", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    sendCardMock.mockResolvedValue(true);
    await createPointAward({ ...baseInput, sendNotification: true });
    expect(sendCardMock).toHaveBeenCalledOnce();
    const upd = updateMock.mock.calls[0][0] as { data: { notified: boolean } };
    expect(upd.data.notified).toBe(true);
  });
  it("does not mark notified when send fails, and still saves the award", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    sendCardMock.mockResolvedValue(false);
    await createPointAward({ ...baseInput, sendNotification: true });
    expect(upsertMock).toHaveBeenCalledOnce();
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("uploads the image and stores imageUrl when notifying with a file", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    sendCardMock.mockResolvedValue(true);
    await createPointAward({ ...baseInput, sendNotification: true, imageFile: fakeImage() });
    expect(uploadMock).toHaveBeenCalledOnce();
    const path = uploadMock.mock.calls[0][0] as string;
    expect(path).toMatch(/^point-awards\/pa1\//);
    const updates = updateMock.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(updates.some((d) => d.imageUrl === path)).toBe(true);
    const cardArg = sendCardMock.mock.calls[0][0] as { imageUrl?: string };
    expect(cardArg.imageUrl).toBe("https://signed.example/photo.png");
  });
  it("does not upload when an image is provided but notification is off", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await createPointAward({ ...baseInput, sendNotification: false, imageFile: fakeImage() });
    expect(uploadMock).not.toHaveBeenCalled();
  });
  it("rejects a non-image file when notifying", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN", name: "SM" } });
    const bad = new File([new Uint8Array([1])], "evil.pdf", { type: "application/pdf" });
    await expect(createPointAward({ ...baseInput, sendNotification: true, imageFile: bad })).rejects.toThrow(/ảnh/i);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("deletePointAward", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    await expect(deletePointAward("pa1")).rejects.toThrow("Forbidden");
    expect(deleteMock).not.toHaveBeenCalled();
  });
  it("lets a manager delete", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    await deletePointAward("pa1");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "pa1" } });
  });
  it("removes the stored image when the award had one", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ imageUrl: "point-awards/pa1/photo.png" });
    await deletePointAward("pa1");
    expect(removeMock).toHaveBeenCalledWith("point-awards/pa1/photo.png");
  });
  it("does not call remove when the award has no image", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ imageUrl: null });
    await deletePointAward("pa1");
    expect(removeMock).not.toHaveBeenCalled();
  });
  it("still succeeds when image cleanup throws", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue({ imageUrl: "point-awards/pa1/photo.png" });
    removeMock.mockRejectedValue(new Error("boom"));
    await expect(deletePointAward("pa1")).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "pa1" } });
  });
});
