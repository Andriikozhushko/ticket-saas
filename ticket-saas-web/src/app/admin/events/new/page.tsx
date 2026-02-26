import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EventForm from "../event-form";

export default async function NewEventPage() {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin) redirect("/");
  const orgs = await prisma.organization.findMany({
    where: { ownerId: session.userId },
    select: { id: true, name: true },
  });
  return (
    <EventForm orgs={orgs} />
  );
}
