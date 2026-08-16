import { describe, it, expect, vi, beforeEach } from "vitest";

// Node 24 + Vitest 4: unhandledRejection fires between Promise.reject() creation and
// the await inside GET(). A non-trivial factory body (with a side-effect before the
// return) prevents Vitest from flagging the rejection as unhandled.
let _calls = 0;
const queryRawMock = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: (...a: unknown[]) => {
      _calls++;
      return queryRawMock(...a);
    },
  },
}));

import { GET } from "../src/app/api/health/route";

beforeEach(() => {
  queryRawMock.mockReset();
  _calls = 0;
});

describe("GET /api/health", () => {
  it("returns 200 ok when the DB responds", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });
  it("returns 503 degraded when the DB throws", async () => {
    queryRawMock.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "degraded" });
  });
});
