import { redirect, notFound } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EventForm from "../event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) redirect("/");
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id },
    include: { org: true, ticketTypes: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) notFound();
  if (!session.isAdmin && event.org.ownerId !== session.userId) notFound();
  const orgs = await prisma.organization.findMany({
    where: session.isAdmin ? undefined : { ownerId: session.userId },
    select: { id: true, name: true },
  });
  return (
    <EventForm
      orgs={orgs}
      event={{
        id: event.id,
        title: event.title,
        priceCents: event.priceCents,
        startsAt: event.startsAt?.toISOString() ?? null,
        venue: event.venue,
        city: event.city,
        posterUrl: event.posterUrl,
        organizerPhotoUrl: event.organizerPhotoUrl,
        description: (event as { description?: string | null }).description ?? null,
        isFinished: event.isFinished,
        orgId: event.orgId,
        ticketTypes: event.ticketTypes.map((t) => ({ id: t.id, name: t.name, priceCents: t.priceCents })),
      }}
    />
  );
}
