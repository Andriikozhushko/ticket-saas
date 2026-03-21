"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stack, Text, NavLink } from "@mantine/core";

const baseLinks = [
  { href: "/admin", label: "Р“РѕР»РѕРІРЅР°" },
  { href: "/admin/users", label: "РљРѕСЂРёСЃС‚СѓРІР°С‡С–" },
  { href: "/admin/events", label: "РџРѕРґС–С—" },
  { href: "/admin/events/new", label: "РќРѕРІР° РїРѕРґС–я" },
];

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links =
    isAdmin && baseLinks.length > 0
      ? [baseLinks[0], { href: "/admin/orders", label: "Р—Р°РјРѕРІР»Рµння" }, ...baseLinks.slice(1)]
      : baseLinks;
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" px="sm">
        РђРґРјС–РЅ
      </Text>
      {links.map((link) => (
        <NavLink
          key={link.href}
          component={Link}
          href={link.href}
          label={link.label}
          active={pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))}
        />
      ))}
    </Stack>
  );
}

