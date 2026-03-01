import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth";
import AdminNav from "./admin-nav";
import AdminShell from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();
  const canAccessAdmin = session?.isAdmin || session?.role === "organizer";
  if (!canAccessAdmin) redirect("/");

  const sidebar = (
    <>
      <div className="admin-sidebar-header">
        <div className="admin-sidebar-title">Lizard.red · Адмін</div>
      </div>
      <nav className="admin-sidebar-nav">
        <AdminNav isAdmin={!!session?.isAdmin} />
      </nav>
    </>
  );

  return (
    <AdminShell sidebar={sidebar}>
      {children}
    </AdminShell>
  );
}
