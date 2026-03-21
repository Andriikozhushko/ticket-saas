import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bufferMatchesMime } from "@/lib/image-validate";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 8 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id: eventId } = await context.params;
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { org: true },
    });
    if (!event || (!session.isAdmin && event.org.ownerId !== session.userId)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Потрібен файл (file)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Дозволені формати: JPEG, PNG, WebP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Розмір файлу до 8 МБ" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!bufferMatchesMime(buffer, file.type)) {
      return NextResponse.json({ error: "Дозволені формати: JPEG, PNG, WebP (файл не відповідає типу)" }, { status: 400 });
    }
    const ext = extFromMime(file.type);
    const dir = path.join(process.cwd(), "public", "uploads", "organizers");
    await mkdir(dir, { recursive: true });
    const filename = `${eventId}.${ext}`;
    const filepath = path.join(dir, filename);
    await writeFile(filepath, buffer);
    const organizerPhotoUrl = `/uploads/organizers/${filename}`;
    await prisma.event.update({
      where: { id: eventId },
      data: { organizerPhotoUrl },
    });
    return NextResponse.json({ organizerPhotoUrl });
  } catch {
    return NextResponse.json({ error: "Помилка завантаження" }, { status: 500 });
  }
}
