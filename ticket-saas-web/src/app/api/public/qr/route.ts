import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

function clampSize(raw: string | null): number {
  const value = Number(raw ?? 220);
  if (!Number.isFinite(value)) {
    return 220;
  }
  return Math.max(120, Math.min(512, Math.round(value)));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data")?.trim() ?? "";
    if (!data) {
      return new NextResponse("Missing data", { status: 400 });
    }

    const size = clampSize(searchParams.get("size"));
    const format = searchParams.get("format") === "png" ? "png" : "svg";

    if (format === "png") {
      const png = await QRCode.toBuffer(data, {
        type: "png",
        width: size,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const svg = await QRCode.toString(data, {
      type: "svg",
      width: size,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("[public/qr]", error);
    return new NextResponse("QR generation failed", { status: 500 });
  }
}
