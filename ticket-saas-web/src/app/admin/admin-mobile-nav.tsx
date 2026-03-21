"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Головна" },
  { href: "/admin/events", label: "Події" },
  { href: "/admin/users", label: "Користувачі" },
  { href: "/admin/events/new", label: "Нова подія" },
] as const;

export default function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-bottom-nav" aria-label="Навігація адмінки">
      {items.map(({ href, label }) => {
        const active =
          pathname === href ||
          (href !== "/admin" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`admin-bottom-nav-item ${active ? "admin-bottom-nav-item-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="admin-bottom-nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
