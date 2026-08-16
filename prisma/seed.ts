import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  Severity,
  MeetingStatus,
} from "../src/generated/prisma/client";
import {
  PROJECT_CATEGORIES,
  DOCUMENT_CATEGORIES,
  TOPIC_CATEGORIES,
  MEETING_CATEGORIES,
  MEETING_SECTIONS,
  WIKI_CATEGORIES,
  PROJECT_ROLES,
} from "../src/lib/master-data";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// 1. Users
// ---------------------------------------------------------------------------
const USERS = [
  {
    email: "trang.hoangthu@vti.com.vn",
    name: "Hoàng Thu Trang",
    role: Role.ADMIN,
    section: "D8",
    title: "System Admin — D8",
  },
  {
    email: "hung.nguyenvan@vti.com.vn",
    name: "Nguyễn Văn Hùng",
    role: Role.DIVISION_LEADER,
    section: "D8",
    title: "Division Leader — D8",
  },
  {
    email: "mai.tranthi@vti.com.vn",
    name: "Trần Thị Mai",
    role: Role.SECTION_MANAGER,
    section: "D8.1",
    title: "Section Manager — D8.1",
  },
  {
    email: "dat.lequang@vti.com.vn",
    name: "Lê Quang Đạt",
    role: Role.PM,
    section: "D8.1",
    title: "Project Manager — D8.1",
  },
  {
    email: "anh.doduc@vti.com.vn",
    name: "Đỗ Đức Anh",
    role: Role.MEMBER,
    section: "D8.2",
    title: "Developer — D8.2",
  },
];

// ---------------------------------------------------------------------------
// 2. Announcements  (title → authorEmail, pinned)
// ---------------------------------------------------------------------------
const ANNOUNCEMENTS = [
  {
    title: "Triển khai PM Sharing Portal — go-live nội bộ 15/06",
    body: "Toàn bộ PM bắt đầu cập nhật Weekly Meeting trên Portal từ tuần 25. Dữ liệu Excel cũ sẽ được migrate xong trước 14/06.",
    pinned: true,
    authorEmail: "hung.nguyenvan@vti.com.vn",
  },
  {
    title: "Lịch nghỉ hè Division: đăng ký trước 20/06",
    body: "Các team gửi kế hoạch nghỉ hè cho Section Manager để cân đối resource cho Q3.",
    pinned: false,
    authorEmail: "mai.tranthi@vti.com.vn",
  },
  {
    title: 'Khóa training "AI cho PM" — mở đăng ký batch 2',
    body: "8 buổi, tối thứ 3 & 5. Ưu tiên PM và BrSE. Đăng ký qua Topics.",
    pinned: false,
    authorEmail: "trang.hoangthu@vti.com.vn",
  },
];

const PROJECTS = [
  { name: "SBI Trading Platform", code: "SBI-TRD", category: "Delivery", section: "D8.1" },
  { name: "Rakuten EC Renewal", code: "RKT-EC", category: "Delivery", section: "D8.1" },
  { name: "AEON Loyalty App", code: "AEO-LOY", category: "Maintenance", section: "D8.1" },
  { name: "Mizuho DX Phase 2", code: "MZH-DX2", category: "Delivery", section: "D8.2" },
];

// ---------------------------------------------------------------------------
// 3. Meetings data from prototype
// ---------------------------------------------------------------------------
const MEETINGS_DATA = [
  {
    week: "Tuần 24",
    weekRange: "08/06 – 12/06/2026",
    status: MeetingStatus.OPEN,
    section: "D8.1",
    ownerEmail: "dat.lequang@vti.com.vn",
    execSummary:
      "Tuần ổn định, không phát sinh issue nghiêm trọng mới. Trọng tâm tuần tới: release Rakuten 14/06 và chốt nhân sự Q3.",
    teamSummary:
      "D8.1: 28 người, 3 dự án chạy. Utilization 94%. 1 member nghỉ ốm dài ngày.\nD8.2: 24 người, 2 dự án. Utilization 88%, có 2 bench chuẩn bị join Sumitomo WMS.\nD8.3: 19 người, ổn định.",
    opportunities:
      "Khách SBI ngỏ ý mở rộng team thêm 4 người từ Q3 nếu UAT đạt chất lượng.\nRakuten đang RFP hệ thống quản lý kho — deadline proposal 25/06.",
    otherInfo: "Khách Panasonic sang office ngày 18/06 — các team chuẩn bị 5S.",
    ee: [
      { project: "SBI Trading Platform", plan: 320, actual: 305, note: "Thiếu 1 dev do nghỉ ốm" },
      { project: "Rakuten EC Renewal", plan: 280, actual: 292, note: "OT cho release 14/06" },
      { project: "AEON Loyalty App", plan: 160, actual: 158, note: "" },
    ],
    ra: [
      {
        name: "Senior Java Dev",
        project: "SBI Trading Platform",
        from: "01/07",
        effort: "2 MM",
        status: "Đang tìm",
      },
      {
        name: "BrSE N2+",
        project: "Mizuho DX Phase 2",
        from: "15/07",
        effort: "1 MM",
        status: "Đã có ứng viên",
      },
    ],
    divisionIssues: [
      {
        title: "Server staging dùng chung quá tải khi 3 dự án cùng UAT",
        severity: "high" as const,
        ownerEmail: "dat.lequang@vti.com.vn",
        status: "open",
      },
      {
        title: "Quy trình review estimate chưa thống nhất giữa các section",
        severity: "medium" as const,
        ownerEmail: "mai.tranthi@vti.com.vn",
        status: "open",
      },
    ],
    companyIssues: [
      {
        title: "Chính sách OT mới cần hướng dẫn áp dụng cho dự án Nhật",
        severity: "medium" as const,
        ownerEmail: "hung.nguyenvan@vti.com.vn",
        status: "open",
      },
    ],
  },
  {
    week: "Tuần 23",
    weekRange: "01/06 – 05/06/2026",
    status: MeetingStatus.CLOSED,
    section: "D8.1",
    ownerEmail: "dat.lequang@vti.com.vn",
    execSummary:
      "Sprint 12 SBI hoàn thành 100% story. Issue staging cần xử lý trong tuần 24.",
    teamSummary:
      "D8.1: utilization 95%. D8.2: 90%. D8.3: ổn định, không biến động.",
    opportunities: "AEON hỏi báo giá maintain năm 2 — đang chuẩn bị estimate.",
    otherInfo: "",
    ee: [
      { project: "SBI Trading Platform", plan: 320, actual: 318, note: "" },
      { project: "Rakuten EC Renewal", plan: 280, actual: 275, note: "" },
      { project: "AEON Loyalty App", plan: 160, actual: 164, note: "Fix bug khẩn bản 2.3" },
    ],
    ra: [
      {
        name: "Senior Java Dev",
        project: "SBI Trading Platform",
        from: "01/07",
        effort: "2 MM",
        status: "Đang tìm",
      },
    ],
    divisionIssues: [
      {
        title: "Server staging dùng chung quá tải khi 3 dự án cùng UAT",
        severity: "high" as const,
        ownerEmail: "dat.lequang@vti.com.vn",
        status: "open",
      },
    ],
    companyIssues: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toSeverity(s: "high" | "medium" | "low"): Severity {
  if (s === "high") return Severity.HIGH;
  if (s === "low") return Severity.LOW;
  return Severity.MEDIUM;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // --- 1. Upsert users ---
  const byEmail: Record<string, string> = {}; // email → id

  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, section: u.section, title: u.title },
      create: { email: u.email, name: u.name, role: u.role, section: u.section, title: u.title },
    });
    byEmail[u.email] = user.id;
  }
  console.log(`✓ Users: ${Object.keys(byEmail).length} upserted`);

  // --- 2. Announcements (findFirst-or-create) ---
  let announcementCount = 0;
  for (const a of ANNOUNCEMENTS) {
    const existing = await db.announcement.findFirst({ where: { title: a.title } });
    if (!existing) {
      await db.announcement.create({
        data: {
          title: a.title,
          body: a.body,
          pinned: a.pinned,
          authorId: byEmail[a.authorEmail],
        },
      });
      announcementCount++;
    }
  }
  console.log(
    `✓ Announcements: ${announcementCount} created (${ANNOUNCEMENTS.length - announcementCount} already existed)`
  );

  for (const p of PROJECTS) {
    await db.project.upsert({
      where: { name_section: { name: p.name, section: p.section } },
      update: { code: p.code, category: p.category, active: true },
      create: p,
    });
  }
  console.log(`Projects: ${PROJECTS.length} upserted`);

  // --- 3. Meetings (findFirst-or-create) ---
  let meetingCount = 0;
  for (const m of MEETINGS_DATA) {
    const existing = await db.meeting.findFirst({ where: { week: m.week } });
    if (existing) {
      console.log(`  - Meeting "${m.week}" already exists, skipping`);
      continue;
    }

    // Create issues first, then connect to the meeting
    const divIssueIds: string[] = [];
    for (const issue of m.divisionIssues) {
      const created = await db.issue.create({
        data: {
          title: issue.title,
          severity: toSeverity(issue.severity),
          status: issue.status,
          ownerId: byEmail[issue.ownerEmail],
        },
      });
      divIssueIds.push(created.id);
    }

    const compIssueIds: string[] = [];
    for (const issue of m.companyIssues) {
      const created = await db.issue.create({
        data: {
          title: issue.title,
          severity: toSeverity(issue.severity),
          status: issue.status,
          ownerId: byEmail[issue.ownerEmail],
        },
      });
      compIssueIds.push(created.id);
    }

    await db.meeting.create({
      data: {
        week: m.week,
        weekRange: m.weekRange,
        category: "Weekly",
        status: m.status,
        section: m.section,
        ownerId: byEmail[m.ownerEmail],
        execSummary: m.execSummary,
        teamSummary: m.teamSummary,
        opportunities: m.opportunities,
        otherInfo: m.otherInfo || null,
        eeRows: {
          create: m.ee.map((row) => ({
            project: row.project,
            plan: row.plan,
            actual: row.actual,
            note: row.note || null,
          })),
        },
        raRows: {
          create: m.ra.map((row) => ({
            name: row.name,
            project: row.project,
            from: row.from,
            effort: row.effort,
            status: row.status,
          })),
        },
        divisionIssues: {
          connect: divIssueIds.map((id) => ({ id })),
        },
        companyIssues: {
          connect: compIssueIds.map((id) => ({ id })),
        },
      },
    });

    meetingCount++;
    console.log(`  + Created meeting "${m.week}"`);
  }
  console.log(
    `✓ Meetings: ${meetingCount} created (${MEETINGS_DATA.length - meetingCount} already existed)`
  );

  // -------------------------------------------------------------------------
  // Master data: categories, skills, certificate types
  // -------------------------------------------------------------------------
  const CATEGORY_SEED: Array<[string, readonly string[]]> = [
    ["PROJECT", PROJECT_CATEGORIES],
    ["DOCUMENT", DOCUMENT_CATEGORIES],
    ["TOPIC", TOPIC_CATEGORIES],
    ["MEETING", MEETING_CATEGORIES],
    ["MEETING_SECTION", MEETING_SECTIONS],
    ["WIKI", WIKI_CATEGORIES],
    ["PROJECT_ROLE", PROJECT_ROLES],
  ];
  for (const [type, values] of CATEGORY_SEED) {
    for (let i = 0; i < values.length; i++) {
      await db.masterCategory.upsert({
        where: { type_value: { type, value: values[i] } },
        create: { type, value: values[i], order: i },
        update: { order: i },
      });
    }
  }
  console.log(`✓ Master categories seeded`);

  const SKILLS = ["Java", "Spring Boot", "React", "Next.js", "AWS", "Project Management"];
  for (const name of SKILLS) {
    await db.skill.upsert({ where: { name }, create: { name }, update: {} });
  }

  const CERT_TYPES: Array<{ name: string; issuer: string }> = [
    { name: "AWS Solutions Architect Associate", issuer: "AWS" },
    { name: "PMP", issuer: "PMI" },
    { name: "TOEIC", issuer: "ETS" },
  ];
  for (const t of CERT_TYPES) {
    await db.certificateType.upsert({ where: { name: t.name }, create: t, update: {} });
  }
  console.log(`✓ Skills and certificate types seeded`);

  console.log(
    `\nSeed complete: ${Object.keys(byEmail).length} users, ${ANNOUNCEMENTS.length} announcements, ${MEETINGS_DATA.length} meetings.`
  );
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
