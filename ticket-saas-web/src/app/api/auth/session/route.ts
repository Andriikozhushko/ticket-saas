import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { getDatabaseHealth } from "@/lib/runtime";

export async function GET() {
  try {
    const db = await getDatabaseHealth();
    if (db.status !== "ok") {
      return NextResponse.json(
        { user: null, error: "РЎРµСЂРІС–СЃ Р±Р°Р·Рё РґР°РЅРёС… С‚РёРјС‡Р°сово РЅРµРґРѕСЃС‚СѓРїРЅРёР№.", dependency: db },
        { status: 503 }
      );
    }

    const session = await getSessionFromCookie();
    if (!session) return NextResponse.json({ user: null }, { status: 200 });

    return NextResponse.json({ user: { email: session.email, isAdmin: session.isAdmin } }, { status: 200 });
  } catch (error) {
    console.error("[auth/session]", error);
    return NextResponse.json({ user: null, error: "РќРµ РІРґР°Р»ося РїРµСЂРµРІС–СЂРёС‚Рё СЃРµСЃС–СЋ." }, { status: 500 });
  }
}

