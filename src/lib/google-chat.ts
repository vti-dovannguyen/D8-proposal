import { formatMonth } from "@/lib/point-award";

export type PointAwardCardPayload = {
  targetName: string;
  targetKind: "PERSON" | "PROJECT";
  points: number;
  reason: string;
  month: string; // "YYYY-MM"
  awarderName: string;
  leaderboardUrl: string;
  imageUrl?: string;          // signed URL of the uploaded image
  celebrationGifUrl?: string; // public URL of the fixed celebration GIF
};

export function buildPointAwardCard(p: PointAwardCardPayload) {
  const icon = p.targetKind === "PERSON" ? "👤" : "📁";
  const kindLabel = p.targetKind === "PERSON" ? "Cá nhân" : "Dự án";
  const widgets: unknown[] = [];
  if (p.celebrationGifUrl) {
    widgets.push({ image: { imageUrl: p.celebrationGifUrl, altText: "🎉 Chúc mừng" } });
  }
  widgets.push({ decoratedText: { topLabel: kindLabel, text: `<b>${icon} ${p.targetName}</b>` } });
  widgets.push({ decoratedText: { topLabel: "Điểm thưởng", text: `<b>⭐ +${p.points} điểm</b>` } });
  if (p.imageUrl) {
    widgets.push({ image: { imageUrl: p.imageUrl, altText: p.targetName } });
  }
  widgets.push({ textParagraph: { text: `💬 ${p.reason}` } });
  widgets.push({ textParagraph: { text: `<i>— by ${p.awarderName}</i>` } });
  if (p.leaderboardUrl) {
    widgets.push({
      buttonList: { buttons: [{ text: "Xem bảng xếp hạng", onClick: { openLink: { url: p.leaderboardUrl } } }] },
    });
  }
  return {
    cardsV2: [
      {
        cardId: "point-award",
        card: {
          header: { title: "🏆 VINH DANH ĐIỂM THƯỞNG", subtitle: formatMonth(p.month) },
          sections: [{ widgets }],
        },
      },
    ],
  };
}

export async function sendPointAwardCard(p: PointAwardCardPayload): Promise<boolean> {
  const url = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPointAwardCard(p)),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to send Google Chat point-award card:", e);
    return false;
  }
}

export type MeetingReportPayload = {
  pmName: string;
  projects: string[];   // distinct, non-empty MeetingEE project names
  section: string;
  meetingUrl: string;   // absolute link, or "" when APP_URL is unset
};

/** Pure: plain-text Google Chat notification for a newly created weekly meeting. */
export function buildMeetingReportMessage(p: MeetingReportPayload): { text: string } {
  const projectClause = p.projects.length ? ` của dự án ${p.projects.join(", ")}` : "";
  const sentence = `PM ${p.pmName}${projectClause} trong section ${p.section} đã viết report weekly.`;
  const link = p.meetingUrl ? ` <${p.meetingUrl}|Nhấn vào đây để xem chi tiết>.` : "";
  return { text: sentence + link };
}

export async function sendMeetingReportNotification(p: MeetingReportPayload): Promise<boolean> {
  const url = process.env.MEETING_CHAT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildMeetingReportMessage(p)),
    });
    return res.ok;
  } catch (e) {
    console.error("Failed to send Google Chat meeting-report notification:", e);
    return false;
  }
}
