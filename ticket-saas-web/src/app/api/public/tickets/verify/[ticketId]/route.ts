import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  context: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await context.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, usedAt: true },
    });
    if (!ticket) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }
    return NextResponse.json({
      valid: true,
      ticketId: ticket.id,
      used: !!ticket.usedAt,
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
