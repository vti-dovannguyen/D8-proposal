import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPointAwardCard,
  sendPointAwardCard,
  buildMeetingReportMessage,
  sendMeetingReportNotification,
  type PointAwardCardPayload,
  type MeetingReportPayload,
} from "@/lib/google-chat";

const payload: PointAwardCardPayload = {
  targetName: "Nguyễn Văn A",
  targetKind: "PERSON",
  points: 85,
  reason: "Hoàn thành xuất sắc dự án X",
  month: "2026-06",
  awarderName: "Section Manager",
  leaderboardUrl: "https://portal.example/point-award",
};

describe("buildPointAwardCard", () => {
  it("builds a Cards v2 payload with header, points and button", () => {
    const card = JSON.stringify(buildPointAwardCard(payload));
    expect(card).toContain("cardsV2");
    expect(card).toContain("VINH DANH");
    expect(card).toContain("Tháng 6/2026");
    expect(card).toContain("+85");
    expect(card).toContain("Nguyễn Văn A");
    expect(card).toContain("https://portal.example/point-award");
  });
  it("omits the button when leaderboardUrl is empty", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, leaderboardUrl: "" }));
    expect(card).not.toContain("buttonList");
  });
  it("includes the celebration GIF image when celebrationGifUrl is set", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, celebrationGifUrl: "https://cdn.example/celebrate.gif" }));
    expect(card).toContain("https://cdn.example/celebrate.gif");
  });
  it("includes the uploaded photo image when imageUrl is set", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, imageUrl: "https://signed.example/photo.png" }));
    expect(card).toContain("https://signed.example/photo.png");
  });
  it("renders no image widget when neither imageUrl nor celebrationGifUrl is set", () => {
    const card = JSON.stringify(buildPointAwardCard(payload));
    expect(card).not.toContain('"image":');
  });
  it("orders the GIF before the points line and the photo after it (before the reason)", () => {
    const card = JSON.stringify(buildPointAwardCard({ ...payload, celebrationGifUrl: "GIFURL", imageUrl: "PHOTOURL" }));
    expect(card.indexOf("GIFURL")).toBeLessThan(card.indexOf("Điểm thưởng"));
    expect(card.indexOf("PHOTOURL")).toBeGreaterThan(card.indexOf("Điểm thưởng"));
    expect(card.indexOf("PHOTOURL")).toBeLessThan(card.indexOf(payload.reason));
  });
});

describe("sendPointAwardCard", () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  beforeEach(() => { delete process.env.GOOGLE_CHAT_WEBHOOK_URL; });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realEnv === undefined) delete process.env.GOOGLE_CHAT_WEBHOOK_URL;
    else process.env.GOOGLE_CHAT_WEBHOOK_URL = realEnv;
  });

  it("returns false and does not fetch when the webhook env is unset", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const ok = await sendPointAwardCard(payload);
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("posts to the webhook and returns true on a 2xx response", async () => {
    process.env.GOOGLE_CHAT_WEBHOOK_URL = "https://chat.example/hook";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    const ok = await sendPointAwardCard(payload);
    expect(ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
  it("returns false when fetch rejects", async () => {
    process.env.GOOGLE_CHAT_WEBHOOK_URL = "https://chat.example/hook";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    expect(await sendPointAwardCard(payload)).toBe(false);
  });
});

const meetingPayload: MeetingReportPayload = {
  pmName: "Nguyễn Văn B",
  projects: ["SBI Trading Platform", "AEON Loyalty App"],
  section: "D8.1",
  meetingUrl: "https://portal.example/meetings/m1",
};

describe("buildMeetingReportMessage", () => {
  it("interpolates pm, joined projects, section, and the detail link", () => {
    const { text } = buildMeetingReportMessage(meetingPayload);
    expect(text).toBe(
      "PM Nguyễn Văn B của dự án SBI Trading Platform, AEON Loyalty App trong section D8.1 đã viết report weekly. <https://portal.example/meetings/m1|Nhấn vào đây để xem chi tiết>."
    );
  });
  it("drops the 'của dự án' clause when there are no projects", () => {
    const { text } = buildMeetingReportMessage({ ...meetingPayload, projects: [] });
    expect(text).toBe(
      "PM Nguyễn Văn B trong section D8.1 đã viết report weekly. <https://portal.example/meetings/m1|Nhấn vào đây để xem chi tiết>."
    );
  });
  it("omits the link when meetingUrl is empty", () => {
    const { text } = buildMeetingReportMessage({ ...meetingPayload, meetingUrl: "" });
    expect(text).toBe(
      "PM Nguyễn Văn B của dự án SBI Trading Platform, AEON Loyalty App trong section D8.1 đã viết report weekly."
    );
    expect(text).not.toContain("<");
  });
});

describe("sendMeetingReportNotification", () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.MEETING_CHAT_WEBHOOK_URL;
  beforeEach(() => { delete process.env.MEETING_CHAT_WEBHOOK_URL; });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realEnv === undefined) delete process.env.MEETING_CHAT_WEBHOOK_URL;
    else process.env.MEETING_CHAT_WEBHOOK_URL = realEnv;
  });

  it("returns false and does not fetch when the webhook env is unset", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    expect(await sendMeetingReportNotification(meetingPayload)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("posts to the webhook and returns true on a 2xx response", async () => {
    process.env.MEETING_CHAT_WEBHOOK_URL = "https://chat.example/meeting-hook";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    expect(await sendMeetingReportNotification(meetingPayload)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
  it("returns false when fetch rejects", async () => {
    process.env.MEETING_CHAT_WEBHOOK_URL = "https://chat.example/meeting-hook";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    expect(await sendMeetingReportNotification(meetingPayload)).toBe(false);
  });
});
