import { describe, it, expect } from "vitest";
import { canDeleteTopic, agentMockReply } from "@/lib/community";

describe("canDeleteTopic()", () => {
  it("lets the author delete their own topic", () => {
    expect(canDeleteTopic("MEMBER", "u1", "u1")).toBe(true);
  });
  it("lets a manager delete anyone's topic", () => {
    expect(canDeleteTopic("SECTION_MANAGER", "u1", "u2")).toBe(true);
    expect(canDeleteTopic("ADMIN", "u1", "u2")).toBe(true);
  });
  it("forbids a non-author non-manager", () => {
    expect(canDeleteTopic("MEMBER", "u1", "u2")).toBe(false);
    expect(canDeleteTopic("PM", "u1", "u2")).toBe(false);
  });
});

describe("agentMockReply()", () => {
  const agent = { name: "BrSE Helper", prompt: "Bạn là trợ lý dịch thuật IT Nhật-Việt." };
  it("includes the agent name, the user message, and a mock marker", () => {
    const out = agentMockReply(agent, "Dịch giúp tôi câu này");
    expect(out).toContain("BrSE Helper");
    expect(out).toContain("Dịch giúp tôi câu này");
    expect(out.toLowerCase()).toContain("mô phỏng");
  });
  it("returns a greeting for an empty message", () => {
    const out = agentMockReply(agent, "   ");
    expect(out).toContain("BrSE Helper");
    expect(out.length).toBeGreaterThan(0);
  });
  it("is deterministic (same input → same output)", () => {
    expect(agentMockReply(agent, "x")).toBe(agentMockReply(agent, "x"));
  });
});
