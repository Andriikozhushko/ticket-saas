import { redirect } from "next/navigation";
import { getSessionFromCookie, ADMIN_EMAIL } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminUsersClient, { type UserRow } from "./admin-users-client";

export default async function AdminUsersPage() {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin || session.email !== ADMIN_EMAIL) redirect("/admin");
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  const users: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));
  return <AdminUsersClient users={users} />;
}
