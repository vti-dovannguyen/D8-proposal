import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn();
vi.mock("@/lib/db", () => ({ db: { $queryRaw: (...a: unknown[]) => queryRawMock(...a) } }));

import { runFullTextSearch } from "@/lib/search";

beforeEach(() => queryRawMock.mockReset());

describe("runFullTextSearch()", () => {
  it("returns [] and does not hit the DB for a blank query", async () => {
    expect(await runFullTextSearch("   ")).toEqual([]);
    expect(queryRawMock).not.toHaveBeenCalled();
  });
  it("queries the DB for a real query", async () => {
    queryRawMock.mockResolvedValue([{ id: "d1", type: "document", title: "T", category: "D8.1", rank: 0.5 }]);
    const rows = await runFullTextSearch("release");
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(rows[0].type).toBe("document");
  });
});
