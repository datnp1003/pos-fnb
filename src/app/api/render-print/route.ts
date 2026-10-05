import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { createPrintJob } from "@/server/reports/print-actions";

export async function GET(req: NextRequest) {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");
  const type = searchParams.get("type") || "BILL";

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  try {
    const result = await createPrintJob({
      orderId,
      type: type as "ORDER" | "TEMP_BILL" | "BILL",
    });

    return NextResponse.json({
      jobId: result.jobId,
      content: result.content || null,
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to render print" }, { status: 500 });
  }
}
