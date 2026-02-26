"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stack, Text, NavLink } from "@mantine/core";

const links = [
  { href: "/admin", label: "Головна" },
  { href: "/admin/users", label: "Користувачі" },
  { href: "/admin/events", label: "Події" },
  { href: "/admin/events/new", label: "Нова подія" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" px="sm">
        Адмін
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
