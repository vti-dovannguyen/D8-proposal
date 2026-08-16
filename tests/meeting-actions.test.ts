import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const findUniqueMock = vi.fn();
const findManyMock = vi.fn();
const projectFindUniqueMock = vi.fn();
const projectFindManyMock = vi.fn();
const attachmentCreate = vi.fn();
const uploadAttachmentFileMock = vi.fn();
const sendMeetingNotifMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("@/lib/db", () => ({
  db: {
    meeting: {
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
    },
    project: {
      findUnique: (...a: unknown[]) => projectFindUniqueMock(...a),
      findMany: (...a: unknown[]) => projectFindManyMock(...a),
    },
    attachment: {
      create: (...a: unknown[]) => attachmentCreate(...a),
    },
  },
}));
vi.mock("@/lib/storage", async (importOriginal) => {
  // Keep the real assertUploadableFile (extension/size validation) so tests
  // exercise the same pre-write validation the actions use in production;
  // only the actual network-touching upload is mocked.
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    uploadToBucket: vi.fn(),
    uploadAttachmentFile: (...a: unknown[]) => uploadAttachmentFileMock(...a),
  };
});
vi.mock("@/lib/google-chat", () => ({
  sendMeetingReportNotification: (...a: unknown[]) => sendMeetingNotifMock(...a),
}));

import { createMeeting, updateMeeting, cloneMeeting, closeMeeting, uploadAttachment, getWeeklySummaryReport } from "../src/app/(portal)/meetings/actions";
import type { MeetingFormData } from "@/types/meeting";

const validForm: MeetingFormData = {
  week: "Tuần 25", weekRange: "15/06 – 19/06/2026", section: "D8.1", projectStatus: "On Schedule", divisionEE: null, status: "DRAFT",
  execSummary: "s", teamSummary: "t", opportunities: "o", otherInfo: "", additionalNote: "",
  eeRows: [{ project: "A", plan: 100, actual: 90, note: "" }],
  raRows: [], risks: [], milestones: [], nextWeekPlans: [], groups: [], divisionIssues: [], companyIssues: [],
};

beforeEach(() => {
  authMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  findUniqueMock.mockReset();
  findManyMock.mockReset();
  projectFindUniqueMock.mockReset();
  projectFindManyMock.mockReset();
  attachmentCreate.mockReset();
  uploadAttachmentFileMock.mockReset();
  createMock.mockResolvedValue({ id: "new1" });
  uploadAttachmentFileMock.mockResolvedValue(undefined);
  sendMeetingNotifMock.mockReset();
  sendMeetingNotifMock.mockResolvedValue(true);
});

describe("createMeeting authorization", () => {
  it("rejects a Member", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(createMeeting(validForm)).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(createMeeting(validForm)).rejects.toThrow("Forbidden");
  });
  it("rejects a blank week", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, week: "  ", status: "OPEN" })).rejects.toThrow("Validation");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("creates for a PM and sets ownerId from session, redirecting to the new meeting", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting(validForm)).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: { ownerId: string; week: string } };
    expect(arg.data.ownerId).toBe("u3");
    expect(arg.data.week).toBe("Tuần 25");
  });
  it("rejects a PM assigning a project they are not PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(createMeeting({ ...validForm, projectId: "p1" })).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("allows a PM assigning a project they are PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "u3" }] });
    await expect(createMeeting({ ...validForm, projectId: "p1" })).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(createMock).toHaveBeenCalledTimes(1);
  });
  it("a manager (SECTION_MANAGER) can assign any project regardless of PIC PM", async () => {
    authMock.mockResolvedValue({ user: { id: "u5", role: "SECTION_MANAGER" } });
    await expect(createMeeting({ ...validForm, projectId: "p1" })).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(projectFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe("updateMeeting authorization", () => {
  it("rejects editing a CLOSED meeting", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "CLOSED" });
    await expect(updateMeeting("m1", validForm)).rejects.toThrow("locked");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("updates an OPEN meeting for an editor", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "u3" });
    await expect(updateMeeting("m1", validForm)).rejects.toThrow("REDIRECT:/meetings/m1");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("rejects a PM updating a meeting tied to a project they are not PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", projectId: "p1", ownerId: "u3" });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(updateMeeting("m1", validForm)).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("allows a PM updating a meeting tied to a project they are PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", projectId: "p1", ownerId: "u3" });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "u3" }] });
    await expect(updateMeeting("m1", validForm)).rejects.toThrow("REDIRECT:/meetings/m1");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("allows a PM who is one of several PIC PMs on the project", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", projectId: "p1", ownerId: "u3" });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }, { id: "u3" }, { id: "another-pm" }] });
    await expect(updateMeeting("m1", validForm)).rejects.toThrow("REDIRECT:/meetings/m1");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
  it("rejects a PM updating a no-project meeting created by someone else", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "someone-else" });
    await expect(updateMeeting("m1", validForm)).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("closeMeeting", () => {
  it("rejects a non-editor", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(closeMeeting("m1")).rejects.toThrow("Forbidden");
  });
  it("sets status CLOSED for an editor", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "u3" });
    await expect(closeMeeting("m1")).rejects.toThrow("REDIRECT:/meetings/m1");
    const arg = updateMock.mock.calls.at(-1)![0] as { data: { status: string } };
    expect(arg.data.status).toBe("CLOSED");
  });
  it("rejects a PM closing a meeting tied to a project they are not PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", projectId: "p1", ownerId: "u3" });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(closeMeeting("m1")).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("rejects a PM closing a no-project meeting created by someone else", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "someone-else" });
    await expect(closeMeeting("m1")).rejects.toThrow("Forbidden");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("cloneMeeting", () => {
  it("rejects a non-editor", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(cloneMeeting("m1")).rejects.toThrow("Forbidden");
  });
  it("creates a new DRAFT copy owned by the current user", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({
      id: "m1", week: "Tuần 24", weekRange: "08/06 – 12/06/2026", section: "D8.1", ownerId: "u3",
      execSummary: "s", teamSummary: "t", opportunities: "o", otherInfo: "", additionalNote: "",
      eeRows: [{ project: "A", plan: 1, actual: 1, note: "" }], raRows: [], risks: [], milestones: [], nextWeekPlans: [], groups: [],
    });
    createMock.mockResolvedValue({ id: "m2" });
    await expect(cloneMeeting("m1")).rejects.toThrow("REDIRECT:/meetings/m2/edit");
    const arg = createMock.mock.calls.at(-1)![0] as { data: { status: string; ownerId: string } };
    expect(arg.data.status).toBe("DRAFT");
    expect(arg.data.ownerId).toBe("u3");
  });
  it("rejects a PM cloning a meeting tied to a project they are not PIC PM on", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({
      id: "m1", week: "Tuần 24", weekRange: "08/06 – 12/06/2026", section: "D8.1", projectId: "p1", ownerId: "u3",
      execSummary: "s", teamSummary: "t", opportunities: "o", otherInfo: "", additionalNote: "",
      eeRows: [{ project: "A", plan: 1, actual: 1, note: "" }], raRows: [], risks: [], milestones: [], nextWeekPlans: [], groups: [],
    });
    projectFindUniqueMock.mockResolvedValue({ picPms: [{ id: "someone-else" }] });
    await expect(cloneMeeting("m1")).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("rejects a PM cloning a no-project meeting created by someone else", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({
      id: "m1", week: "Tuần 24", weekRange: "08/06 – 12/06/2026", section: "D8.1", ownerId: "someone-else",
      execSummary: "s", teamSummary: "t", opportunities: "o", otherInfo: "", additionalNote: "",
      eeRows: [{ project: "A", plan: 1, actual: 1, note: "" }], raRows: [], risks: [], milestones: [], nextWeekPlans: [], groups: [],
    });
    await expect(cloneMeeting("m1")).rejects.toThrow("Forbidden");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("uploadAttachment", () => {
  it("uploadAttachment stores the object path (not a signed URL)", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "abcdefghij1234567890", status: "OPEN", ownerId: "u3" });
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1])], "n.pdf", { type: "application/pdf" }));
    await uploadAttachment("abcdefghij1234567890", fd);
    const arg = attachmentCreate.mock.calls[0][0] as { data: { fileUrl: string } };
    expect(arg.data.fileUrl.startsWith("abcdefghij1234567890/")).toBe(true);
  });
});

describe("createMeeting notification", () => {
  it("posts a meeting-report notification with pm, projects, section and link", async () => {
    const realAppUrl = process.env.APP_URL;
    process.env.APP_URL = "https://portal.example";
    try {
      authMock.mockResolvedValue({ user: { id: "u3", role: "PM", name: "Nguyễn B" } });
      createMock.mockResolvedValue({ id: "new1", section: "D8.1" });
      await expect(createMeeting(validForm)).rejects.toThrow("REDIRECT:/meetings/new1");
      expect(sendMeetingNotifMock).toHaveBeenCalledTimes(1);
      expect(sendMeetingNotifMock.mock.calls[0][0]).toEqual({
        pmName: "Nguyễn B",
        projects: ["A"],
        section: "D8.1",
        meetingUrl: "https://portal.example/meetings/new1",
      });
    } finally {
      if (realAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = realAppUrl;
    }
  });
});

describe("getWeeklySummaryReport", () => {
  it("rejects a non-editor", async () => {
    authMock.mockResolvedValue({ user: { id: "u4", role: "MEMBER" } });
    await expect(getWeeklySummaryReport("2026-06-15T00:00", "2026-06-21T23:59")).rejects.toThrow("Forbidden");
  });
  it("rejects any editor role other than SECTION_MANAGER or DIVISION_LEADER", async () => {
    for (const role of ["ADMIN", "PM"]) {
      authMock.mockResolvedValue({ user: { id: "u1", role } });
      await expect(getWeeklySummaryReport("2026-06-15T00:00", "2026-06-21T23:59")).rejects.toThrow("Forbidden");
    }
    expect(findManyMock).not.toHaveBeenCalled();
  });
  it("allows a DIVISION_LEADER", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "DIVISION_LEADER" } });
    findManyMock.mockResolvedValue([]);
    await expect(getWeeklySummaryReport("2026-06-15T00:00", "2026-06-21T23:59")).resolves.toEqual([]);
  });
  it("rejects a blank or invalid date range", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    await expect(getWeeklySummaryReport("", "2026-06-21T23:59")).rejects.toThrow("Validation");
    await expect(getWeeklySummaryReport("2026-06-21T23:59", "2026-06-15T00:00")).rejects.toThrow("Validation");
  });
  it("queries overlapping meetings and groups by section", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SECTION_MANAGER" } });
    findManyMock.mockResolvedValue([
      {
        id: "m1", section: "D8.1", updatedAt: new Date("2026-06-16T09:40:00Z"),
        owner: { name: "Lê Quang Đạt" }, projectId: null, project: null,
        eeRows: [{ project: "SBI Trading Platform" }],
        projectStatus: "On Schedule", divisionEE: 92, execSummary: "<p>Đã hoàn thành phần lớn công việc tuần này.</p>", risks: [],
      },
    ]);
    const groups = await getWeeklySummaryReport("2026-06-15T00:00", "2026-06-21T23:59");
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const args = findManyMock.mock.calls[0][0] as { where: { weekStart: { lte: Date }; weekEnd: { gte: Date } } };
    expect(args.where.weekStart.lte).toEqual(new Date("2026-06-21T23:59:59.999"));
    expect(args.where.weekEnd.gte).toEqual(new Date("2026-06-15T00:00:00.000"));
    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe("D8.1");
    expect(groups[0].rows).toMatchObject([
      { meetingId: "m1", projectName: "SBI Trading Platform", ownerName: "Lê Quang Đạt", projectStatus: "On Schedule", divisionEE: 92, riskSummary: "Không có risk/issue." },
    ]);
  });
});

describe("createMeeting risks", () => {
  it("persists risk rows alongside the meeting", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    const risks = [
      { type: "Issue", title: "Vendor delay", impact: "HIGH" as const, actionPlan: "a", status: "Open", planDate: "2026-08-16" },
    ];
    await expect(createMeeting({ ...validForm, risks })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as { data: { risks: { create: unknown[] } } };
    expect(arg.data.risks.create).toEqual([
      { type: "Issue", title: "Vendor delay", impact: "HIGH", actionPlan: "a", status: "Open", planDate: new Date("2026-08-16") },
    ]);
  });
});

describe("createMeeting groups", () => {
  it("persists sub-project groups with nested milestones and risks", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    const groups = [
      {
        name: "OD + SG",
        status: "At Risk",
        progressNote: "Sprint 3 done",
        milestones: [{ name: "UAT Complete", planDate: "2026-08-16", status: "At Risk", note: "Delay" }],
        risks: [{ type: "Issue", title: "Thiếu tài nguyên QA", impact: "HIGH" as const, actionPlan: "Bổ sung QA", status: "Open", planDate: "2026-08-09" }],
        nextWeekPlans: [{ keyActivity: "Hoàn thành UAT", note: "UAT Sign-off" }],
      },
    ];
    await expect(createMeeting({ ...validForm, groups })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as {
      data: {
        groups: {
          create: {
            name: string; status: string; progressNote: string; order: number;
            milestones: { create: unknown[] }; risks: { create: unknown[] }; nextWeekPlans: { create: unknown[] };
          }[];
        };
      };
    };
    expect(arg.data.groups.create).toEqual([
      {
        name: "OD + SG",
        status: "At Risk",
        progressNote: "Sprint 3 done",
        order: 0,
        milestones: { create: [{ name: "UAT Complete", planDate: new Date("2026-08-16"), status: "At Risk", note: "Delay" }] },
        risks: { create: [{ type: "Issue", title: "Thiếu tài nguyên QA", impact: "HIGH", actionPlan: "Bổ sung QA", status: "Open", planDate: new Date("2026-08-09") }] },
        nextWeekPlans: { create: [{ keyActivity: "Hoàn thành UAT", note: "UAT Sign-off" }] },
      },
    ]);
  });
});

describe("createMeeting projectStatus", () => {
  it("persists the selected project status", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, projectStatus: "Late" })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as { data: { projectStatus: string } };
    expect(arg.data.projectStatus).toBe("Late");
  });
  it("defaults to the first project status when blank", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, projectStatus: "  " })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as { data: { projectStatus: string } };
    expect(arg.data.projectStatus).toBe("On Schedule");
  });
});

describe("createMeeting divisionEE", () => {
  it("persists the entered division EE percentage", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, divisionEE: 85 })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as { data: { divisionEE: number | null } };
    expect(arg.data.divisionEE).toBe(85);
  });
  it("persists null when left blank", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, divisionEE: null })).rejects.toThrow("REDIRECT:/meetings/new1");
    const arg = createMock.mock.calls[0][0] as { data: { divisionEE: number | null } };
    expect(arg.data.divisionEE).toBeNull();
  });
});

describe("updateMeeting risks", () => {
  it("replaces risk rows alongside the meeting update", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "u3" });
    const risks = [
      { type: "Issue", title: "Vendor delay", impact: "HIGH" as const, actionPlan: "a", status: "Open", planDate: "2026-08-16" },
    ];
    await expect(updateMeeting("m1", { ...validForm, risks })).rejects.toThrow("REDIRECT:/meetings/m1");
    const arg = updateMock.mock.calls[0][0] as { data: { risks: { deleteMany: unknown; create: unknown[] } } };
    expect(arg.data.risks).toEqual({
      deleteMany: {},
      create: [{ type: "Issue", title: "Vendor delay", impact: "HIGH", actionPlan: "a", status: "Open", planDate: new Date("2026-08-16") }],
    });
  });
});

describe("createMeeting draft validation bypass", () => {
  it("allows an incomplete DRAFT to be saved without required fields", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, week: "", weekRange: "", status: "DRAFT" })).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(createMock).toHaveBeenCalledTimes(1);
  });
  it("still requires week/weekRange when status is not DRAFT", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting({ ...validForm, week: "", status: "OPEN" })).rejects.toThrow("Validation");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("createMeeting multi-file attachments", () => {
  it("uploads every staged file under the new meeting id", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    const fd = new FormData();
    fd.append("files", new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" }));
    fd.append("files", new File([new Uint8Array([2])], "b.png", { type: "image/png" }));
    await expect(createMeeting(validForm, fd)).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(uploadAttachmentFileMock).toHaveBeenCalledTimes(2);
    expect(attachmentCreate).toHaveBeenCalledTimes(2);
    const firstPath = attachmentCreate.mock.calls[0][0].data.fileUrl as string;
    expect(firstPath.startsWith("new1/")).toBe(true);
  });
  it("does nothing when no filesFormData is passed", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    await expect(createMeeting(validForm)).rejects.toThrow("REDIRECT:/meetings/new1");
    expect(uploadAttachmentFileMock).not.toHaveBeenCalled();
    expect(attachmentCreate).not.toHaveBeenCalled();
  });
});

describe("updateMeeting multi-file attachments", () => {
  it("uploads staged files against the existing meeting id", async () => {
    authMock.mockResolvedValue({ user: { id: "u3", role: "PM" } });
    findUniqueMock.mockResolvedValue({ id: "m1", status: "OPEN", ownerId: "u3" });
    const fd = new FormData();
    fd.append("files", new File([new Uint8Array([1])], "c.pdf", { type: "application/pdf" }));
    await expect(updateMeeting("m1", validForm, fd)).rejects.toThrow("REDIRECT:/meetings/m1");
    expect(uploadAttachmentFileMock).toHaveBeenCalledTimes(1);
    const path = attachmentCreate.mock.calls[0][0].data.fileUrl as string;
    expect(path.startsWith("m1/")).toBe(true);
  });
});
