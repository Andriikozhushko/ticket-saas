import { NextResponse } from "next/server";
import { refreshOrderPaymentSnapshot } from "@/lib/payments";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await refreshOrderPaymentSnapshot(id, true);
    if (!result) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(result.snapshot);
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 500 });
  }
}
