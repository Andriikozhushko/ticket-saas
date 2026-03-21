"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Р“РѕР»РѕРІРЅР°" },
  { href: "/admin/events", label: "РџРѕРґС–С—" },
  { href: "/admin/users", label: "РљРѕСЂРёСЃС‚СѓРІР°С‡С–" },
  { href: "/admin/events/new", label: "РќРѕРІР° РїРѕРґС–я" },
] as const;

export default function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-bottom-nav" aria-label="РќР°РІС–РіР°С†С–я Р°РґРјС–РЅРєРё">
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

