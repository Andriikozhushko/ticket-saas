import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminDashboard from "./admin-dashboard";

export default async function AdminPage() {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) redirect("/");

  const orgs = await prisma.organization.findMany({
    where: session.isAdmin ? undefined : { ownerId: session.userId },
    include: {
      mono: true,
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <AdminDashboard
      orgs={orgs.map((o) => ({
        id: o.id,
        name: o.name,
        hasMono: !!o.mono,
        jars: [],
        events: o.events.map((e) => ({
          id: e.id,
          title: e.title,
          priceCents: e.priceCents,
          monoAccountId: e.monoAccountId,
          posterUrl: e.posterUrl,
        })),
      }))}
    />
  );
}
