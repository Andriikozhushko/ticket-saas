import { prisma } from "@/lib/prisma";
import { getSessionFromCookie } from "@/lib/auth";
import Link from "next/link";
import { Box, Title, Text, Badge, Stack, Group, Card } from "@mantine/core";
import EventTicketsBlock from "./event-tickets-block";

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatDateDot(d?: Date | null) {
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Kyiv",
    }).format(d);
  } catch {
    return null;
  }
}

function formatTime(d?: Date | null) {
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Kyiv",
    }).format(d);
  } catch {
    return null;
  }
}

function formatDateShort(d?: Date | null) {
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Kyiv",
    }).format(d);
  } catch {
    return null;
  }
}

function PosterFallback({ seed, title }: { seed: string; title: string }) {
  const n = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const h = n % 360;
  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(135deg, hsl(${h}, 45%, 18%) 0%, hsl(${h}, 35%, 10%) 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: "4rem", fontWeight: 800, color: "rgba(255,255,255,0.15)", letterSpacing: "-0.04em" }}>
        {title.charAt(0)}
      </span>
    </Box>
  );
}

function StatusBadge({ status, expiresAt }: { status: string; expiresAt?: Date }) {
  const now = new Date();
  const isExpired = expiresAt && expiresAt < now;
  const displayStatus = status === "awaiting_payment" && isExpired ? "expired" : status;
  const labels: Record<string, string> = {
    paid: "РћРїР»Р°С‡РµРЅРѕ",
    awaiting_payment: "РћС‡С–РєСѓС” РѕРїР»Р°С‚Рё",
    expired: "Р§Р°СЃ РІРёР№С€РѕРІ",
  };
  const colorMap: Record<string, string> = {
    paid: "green",
    awaiting_payment: "yellow",
    expired: "red",
  };
  return (
    <Badge variant="outline" color={colorMap[displayStatus] ?? "gray"} size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
      {labels[displayStatus] ?? displayStatus}
    </Badge>
  );
}

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconCity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
    <path d="M9 18v.01" />
  </svg>
);
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

type EventPageData = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  startsAt: Date | null;
  city: string | null;
  venue: string | null;
  posterUrl: string | null;
  organizerPhotoUrl: string | null;
  description?: string | null;
  monoAccountId: string | null;
  org: { name: string };
  ticketTypes: { id: string; name: string; priceCents: number }[];
  _count?: { orders: number };
  orders?: { id: string; buyerEmail: string; amountExpectedCents: number; status: string; createdAt: Date; expiresAt: Date }[];
};

export default async function EventPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getSessionFromCookie();
  const isAdmin = session?.isAdmin ?? false;

  const e = (await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      priceCents: true,
      currency: true,
      startsAt: true,
      city: true,
      venue: true,
      posterUrl: true,
      organizerPhotoUrl: true,
      description: true,
      monoAccountId: true,
      org: { select: { name: true } },
      ticketTypes: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, priceCents: true } },
      ...(isAdmin
        ? {
            _count: { select: { orders: true } },
            orders: {
              orderBy: { createdAt: "desc" },
              take: 12,
              select: { id: true, buyerEmail: true, amountExpectedCents: true, status: true, createdAt: true, expiresAt: true },
            },
          }
        : {}),
    },
  })) as EventPageData | null;

  if (!e) {
    return (
      <Stack gap="lg" maw={480} mx="auto" p="xl">
        <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)", textDecoration: "none" }}>
          в†ђ РќР°Р·Р°Рґ РґРѕ Р°С„С–С€С–
        </Link>
        <Card withBorder padding="xl" radius="md" style={{ borderColor: "var(--border)", textAlign: "center", background: "var(--card-bg)" }}>
          <Title order={2} style={{ margin: "0 0 8px 0", fontSize: 22, fontWeight: 700 }}>РџРѕРґС–СЋ РЅРµ Р·РЅР°Р№РґРµРЅРѕ</Title>
          <Text size="sm" c="dimmed">РџРµСЂРµРІС–СЂС‚Рµ РїРѕСЃРёР»Р°ння</Text>
        </Card>
      </Stack>
    );
  }

  const dateDot = formatDateDot(e.startsAt);
  const time = formatTime(e.startsAt);
  const venue = e.venue?.trim() || null;
  const city = e.city?.trim() || null;

  return (
    <Box style={{ minHeight: "100vh" }}>
      <Box className="page-bg-glow" />
      <Box className="event-page-container">
        {/* РљРЅРѕРїРєР° РІРіРѕСЂС– */}
        <Box style={{ alignSelf: "stretch", paddingBottom: 24 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}>
            в†ђ РќР°Р·Р°Рґ РґРѕ Р°С„С–С€С–
          </Link>
        </Box>

        {/* РџРѕСЃС‚РµСЂ РїРѕРґС–С— вЂ” РїРѕРІРЅР° С€РёСЂРёРЅР° С‚Р° РІРёСЃРѕС‚Р°, Р±РµР· РѕР±СЂС–Р·Р°ння */}
        <Box
          className="event-poster-wrap"
          style={{
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 32,
            width: "100%",
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
          }}
        >
          {e.posterUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={e.posterUrl}
              alt={e.title}
              className="event-poster-img"
            />
          ) : (
            <PosterFallback seed={e.id} title={e.title} />
          )}
        </Box>

        {/* Р—Р°РіРѕР»РѕРІРѕРє */}
        <Box style={{ width: "100%", maxWidth: 720, marginBottom: 24 }}>
          <Title order={1} style={{ margin: 0, fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 700, lineHeight: 1.2, color: "var(--text)", textAlign: "left" }}>
            {e.title}
          </Title>
        </Box>

        {/* Р”Р°С‚Р°, С‡Р°СЃ, РјС–СЃС†Рµ вЂ” РІРёС‰Рµ Р±Р»оку РєРІРёС‚РєС–РІ */}
        {(dateDot || time || venue || city) && (
          <Box
            className="event-datetime-place-block"
            style={{
              width: "100%",
              maxWidth: 720,
              marginBottom: 24,
              padding: "20px 24px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <Stack gap={8} style={{ alignItems: "flex-start", textAlign: "left" }}>
              {dateDot && (
                <Group gap={8} align="center">
                  <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconCalendar /></Box>
                  <Text size="md" fw={700} style={{ color: "var(--text)", letterSpacing: "0.02em" }}>{dateDot}</Text>
                </Group>
              )}
              {time && (
                <Group gap={8} align="center">
                  <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconClock /></Box>
                  <Text size="md" fw={700} style={{ color: "var(--text)", letterSpacing: "0.04em" }}>{time}</Text>
                </Group>
              )}
              {venue && (
                <Group gap={8} align="center">
                  <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconPin /></Box>
                  <Text size="md" style={{ color: "var(--text)", fontWeight: 600 }}>{venue}</Text>
                </Group>
              )}
              {city && (
                <Group gap={8} align="center">
                  <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconCity /></Box>
                  <Text size="md" style={{ color: "var(--text)", fontWeight: 600 }}>{city}</Text>
                </Group>
              )}
            </Stack>
          </Box>
        )}

        {/* РљРІРёС‚РєРё/РѕРїР»Р°С‚Р° */}
        <Box id="tickets" style={{ width: "100%", maxWidth: 720, marginBottom: 40 }}>
          <EventTicketsBlock
            eventId={e.id}
            eventTitle={e.title}
            dateFormatted={dateDot}
            currency={e.currency}
            eventPriceCents={e.priceCents}
            ticketTypes={e.ticketTypes}
          />
        </Box>

        {/* РџРѕС‚С–Рј опис вЂ” С€РёСЂС€РёР№ С‚РµРєСЃС‚ */}
        {e.description && e.description.trim() && (
          <Box style={{ width: "100%", maxWidth: 720, marginBottom: 32, textAlign: "left" }}>
            <Text
              size="md"
              style={{
                lineHeight: 1.75,
                color: "var(--text)",
                whiteSpace: "pre-wrap",
              }}
            >
              {e.description.trim()}
            </Text>
          </Box>
        )}

        {/* Disclaimer */}
        <Text size="xs" c="dimmed" mt="md" style={{ width: "100%", maxWidth: 720, lineHeight: 1.6, textAlign: "left" }}>
          * РџС–СЃР»я РѕРїР»Р°С‚Рё РєРІРёС‚РѕРє РЅР°РґС–Р№РґРµ РЅР° email (QR-РєРѕРґ). РџРµСЂРµРІС–СЂС‚Рµ РїР°пку В«Р РµРєР»Р°РјР°В» Р°Р±Рѕ В«РџСЂРѕРјРѕВ» Сѓ Gmail.
        </Text>

        {isAdmin && e.orders && (
          <Card withBorder padding="lg" radius="md" mt={48} style={{ width: "100%", maxWidth: 720, borderColor: "var(--border)", backgroundColor: "var(--card-bg)" }}>
            <Group justify="space-between" mb="md" pb="md" style={{ borderBottom: "1px solid var(--border)" }}>
              <Text fw={700} size="md">РћСЃС‚Р°РЅРЅС– Р·Р°РјРѕРІР»Рµння</Text>
              <Text size="sm" c="dimmed">Р’сього: {e._count?.orders ?? 0}</Text>
            </Group>
            {!e.orders.length ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">Р—Р°РјРѕРІР»Рµнь РїРѕРєРё РЅРµРјР°С”</Text>
            ) : (
              <Stack gap={0}>
                {e.orders.map((order) => (
                  <Group key={order.id} justify="space-between" py="sm" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Box>
                      <Text size="sm" fw={600}>{order.buyerEmail}</Text>
                      <Text size="xs" c="dimmed">{formatDateShort(order.createdAt)} В· {money(order.amountExpectedCents)} {e.currency}</Text>
                    </Box>
                    <StatusBadge status={order.status} expiresAt={order.expiresAt} />
                  </Group>
                ))}
              </Stack>
            )}
          </Card>
        )}
      </Box>
    </Box>
  );
}

