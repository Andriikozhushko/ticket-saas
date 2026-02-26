"use client";

import Link from "next/link";
import { AppShell, Box, Burger, Container, Drawer, Group } from "@mantine/core";
import ScrollLizard from "@/app/scroll-lizard";
import { useDisclosure } from "@mantine/hooks";
import { AnimatedBackground } from "./animated-background";
import AuthBlock from "./auth-block";
import { AuthOpenProvider } from "./auth-open-context";

const NAV_BREAKPOINT = "sm";

const navLinkClass = "shell-nav-link";

type ShellProps = {
  children: React.ReactNode;
  initialUser?: { email: string; isAdmin: boolean } | null;
};

function ShellInner({ children, initialUser = null }: ShellProps) {
  const [opened, { toggle, close }] = useDisclosure(false);

  const navLinks = (
    <>
      <Link href="/" className={navLinkClass} onClick={close}>Афіша</Link>
      <Link href="/my-tickets" className={navLinkClass} onClick={close}>Мої квитки</Link>
      <Link href="/about" className={navLinkClass} onClick={close}>Про нас</Link>
      <AuthBlock initialUser={initialUser} />
    </>
  );

  return (
    <AppShell
      header={{ height: { base: 56, [NAV_BREAKPOINT]: 72 } }}
      padding={0}
      styles={{ main: { background: "transparent", position: "relative" } }}
    >
      <ScrollLizard />
      <AnimatedBackground />
      <AppShell.Header
        style={{
          background: "linear-gradient(180deg, rgba(18,8,8,0.95) 0%, rgba(10,4,4,0.92) 100%)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <Container size={1120} h="100%" px={{ base: "sm", sm: "md" }}>
          <Group justify="space-between" h="100%" wrap="nowrap" gap="md">
            <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", minWidth: 0 }}>
              <img
                src="/logo.png"
                alt="Lizard.red"
                style={{
                  height: "clamp(32px, 8vw, 52px)",
                  width: "auto",
                  display: "block",
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 24px rgba(239,68,68,0.5))",
                  transition: "transform 0.2s ease, filter 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.filter = "drop-shadow(0 0 32px rgba(239,68,68,0.6))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.filter = "drop-shadow(0 0 24px rgba(239,68,68,0.5))";
                }}
              />
            </Link>
            <Group gap={6} className="shell-nav-desktop">
              {navLinks}
            </Group>
            <Box className="shell-nav-mobile">
              <Burger opened={opened} onClick={toggle} size="sm" color="rgba(255,255,255,0.9)" aria-label="Меню" />
            </Box>
          </Group>
        </Container>
      </AppShell.Header>

      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="min(320px, 88vw)"
        classNames={{
          content: "shell-drawer-content",
          header: "shell-drawer-header",
          body: "shell-drawer-body",
          title: "shell-drawer-title",
        }}
        title="Меню"
        styles={{
          header: { borderBottom: "1px solid var(--border)" },
        }}
      >
        <nav className="shell-drawer-nav">
          {navLinks}
        </nav>
      </Drawer>

      <AppShell.Main>
        <Box style={{ position: "relative", zIndex: 1 }}>
          <Container size={1120} py={{ base: 20, sm: 32 }} px={{ base: "sm", sm: "md" }}>
            {children}
          </Container>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}

export default function Shell(props: ShellProps) {
  return (
    <AuthOpenProvider initialUser={props.initialUser ?? null}>
      <ShellInner {...props} />
    </AuthOpenProvider>
  );
}
