import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { unitMonthly: { upsert: (...a: unknown[]) => upsert(...a) } } }));

import { setUnitHeadcount } from "../src/app/(portal)/dashboard/actions";

beforeEach(() => { authMock.mockReset(); upsert.mockReset(); });

describe("setUnitHeadcount auth", () => {
  it("blocks a MEMBER", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "MEMBER" } });
    await expect(setUnitHeadcount("2026-06", "intern", 5)).rejects.toThrow("Forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("blocks a PM (managers only)", async () => {
    authMock.mockResolvedValue({ user: { id: "u0", role: "PM" } });
    await expect(setUnitHeadcount("2026-06", "intern", 5)).rejects.toThrow("Forbidden");
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("setUnitHeadcount validation + upsert", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "u0", role: "ADMIN" } }));
  it("rejects a bad month", async () => {
    await expect(setUnitHeadcount("2026/06", "intern", 5)).rejects.toThrow(/tháng/i);
  });
  it("rejects an unknown field", async () => {
    // @ts-expect-error testing runtime guard on an invalid field
    await expect(setUnitHeadcount("2026-06", "bogus", 5)).rejects.toThrow(/trường/i);
  });
  it("coerces negatives and fractions to a non-negative integer and upserts by month", async () => {
    await setUnitHeadcount("2026-06", "official", 136.6);
    expect(upsert).toHaveBeenCalledWith({
      where: { month: "2026-06" },
      create: { month: "2026-06", official: 137 },
      update: { official: 137 },
    });
    await setUnitHeadcount("2026-06", "lbQaOt", -3);
    expect(upsert).toHaveBeenLastCalledWith({
      where: { month: "2026-06" },
      create: { month: "2026-06", lbQaOt: 0 },
      update: { lbQaOt: 0 },
    });
  });
});
