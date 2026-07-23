import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import * as printActions from "@/server/reports/print-actions";
import { GET } from "./route";

vi.mock("@/server/reports/print-actions");

function req(qs: string) {
  return new NextRequest(`http://localhost/api/render-print${qs}`);
}

beforeEach(() => {
  vi.mocked(printActions.createPrintJob).mockResolvedValue({
    jobId: "job-1",
    content: "TICKET",
    success: true,
  } as never);
});

describe("GET /api/render-print", () => {
  it("returns 400 when orderId missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
  });

  it("returns the rendered print job", async () => {
    const res = await GET(req("?orderId=o1&type=BILL"));
    const body = await res.json();
    expect(body).toMatchObject({ jobId: "job-1", content: "TICKET", success: true });
    expect(printActions.createPrintJob).toHaveBeenCalledWith({ orderId: "o1", type: "BILL" });
  });

  it("returns 500 when createPrintJob throws", async () => {
    vi.mocked(printActions.createPrintJob).mockRejectedValue(new Error("fail"));
    const res = await GET(req("?orderId=o1"));
    expect(res.status).toBe(500);
  });
});
