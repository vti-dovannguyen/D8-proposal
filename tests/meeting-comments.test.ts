import { describe, expect, it } from "vitest";
import {
  canManageMeetingComments,
  getMeetingCommentDisplayState,
  nextMeetingCommentReaction,
  normalizeMeetingCommentContent,
} from "../src/lib/meeting-comments";

describe("normalizeMeetingCommentContent", () => {
  it("trims surrounding whitespace before saving", () => {
    expect(normalizeMeetingCommentContent("  Need an escalation.  ")).toBe("Need an escalation.");
  });

  it("rejects an empty comment", () => {
    expect(() => normalizeMeetingCommentContent("  ")).toThrow("Validation: empty comment");
  });

  it("rejects comments longer than the supported limit", () => {
    expect(() => normalizeMeetingCommentContent("x".repeat(2001))).toThrow("Validation: comment is too long");
  });
});

describe("meeting comment permissions", () => {
  it.each([
    ["ADMIN", true],
    ["DIVISION_LEADER", true],
    ["SECTION_MANAGER", true],
    ["PM", false],
    ["MEMBER", false],
  ] as const)("allows manager role %s to manage comments: %s", (role, expected) => {
    expect(canManageMeetingComments(role)).toBe(expected);
  });
});

describe("meeting comment edit state", () => {
  it("shows a newly created comment at its creation time without an edited marker", () => {
    expect(getMeetingCommentDisplayState("2026-08-22T01:00:00.000Z", null)).toEqual({
      timestamp: "2026-08-22T01:00:00.000Z",
      edited: false,
    });
  });

  it("shows an edited comment at its explicit edit time with an edited marker", () => {
    expect(
      getMeetingCommentDisplayState(
        "2026-08-22T01:00:00.000Z",
        "2026-08-22T02:30:00.000Z",
      ),
    ).toEqual({
      timestamp: "2026-08-22T02:30:00.000Z",
      edited: true,
    });
  });
});

describe("nextMeetingCommentReaction", () => {
  it("removes the current reaction when the same reaction is selected", () => {
    expect(nextMeetingCommentReaction("LIKE", "LIKE")).toBeNull();
  });

  it("switches a reaction when the opposite option is selected", () => {
    expect(nextMeetingCommentReaction("LIKE", "UNLIKE")).toBe("UNLIKE");
  });

  it("sets a reaction when the user has not reacted yet", () => {
    expect(nextMeetingCommentReaction(null, "LIKE")).toBe("LIKE");
  });
});
