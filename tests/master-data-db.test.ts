import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/db", () => ({ db: { masterCategory: { findMany: (...a: unknown[]) => findManyMock(...a) } } }));

import { getCategoryValues } from "@/lib/master-data-db";
import { PROJECT_CATEGORIES } from "@/lib/master-data";

beforeEach(() => findManyMock.mockReset());

describe("getCategoryValues", () => {
  it("returns DB values when present", async () => {
    findManyMock.mockResolvedValue([{ value: "Alpha" }, { value: "Beta" }]);
    expect(await getCategoryValues("PROJECT")).toEqual(["Alpha", "Beta"]);
  });
  it("falls back to the constant list when the table is empty", async () => {
    findManyMock.mockResolvedValue([]);
    expect(await getCategoryValues("PROJECT")).toEqual([...PROJECT_CATEGORIES]);
  });
  it("falls back to PROJECT_ROLES for the PROJECT_ROLE type", async () => {
    findManyMock.mockResolvedValue([]);
    const { PROJECT_ROLES } = await import("@/lib/master-data");
    expect(await getCategoryValues("PROJECT_ROLE")).toEqual([...PROJECT_ROLES]);
  });
});
