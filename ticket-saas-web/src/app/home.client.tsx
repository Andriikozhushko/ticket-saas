"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AspectRatio,
  Box,
  Card,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useAuthOpen } from "./auth-open-context";

type EventVM = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  isFinished: boolean;
  startsAt: string | null; // ISO
  city: string | null;
  venue: string | null;
  posterUrl: string | null;
  orgName: string | null;
  ordersCount: number;
  ticketTypesCount: number;
};

type InitialUser = { email: string; isAdmin: boolean } | null;

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(d);
}

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

function PosterFallback({ seed, title }: { seed: string; title: string }) {
  const n = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const a = n % 360;
  const b = (a + 70) % 360;

  return (
    <Box
      h="100%"
      w="100%"
      style={{
        position: "relative",
        background: `radial-gradient(1100px 500px at 15% 10%, hsla(${a},90%,60%,0.38), transparent 52%),
                     radial-gradient(900px 450px at 88% 15%, hsla(${b},85%,56%,0.28), transparent 48%),
                     linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 35%, rgba(0,0,0,0.75) 100%)`,
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 18,
        }}
      >
        <Text
          style={{
            fontSize: 64,
            fontWeight: 950,
            letterSpacing: -2,
            color: "rgba(255,255,255,0.22)",
            textTransform: "uppercase",
          }}
        >
          {title?.slice(0, 1) || "M"}
        </Text>
      </Box>
    </Box>
  );
}

const cardStyle = {
  overflow: "hidden" as const,
  borderRadius: 12,
  borderColor: "rgba(255,255,255,0.08)",
  background: "var(--card-bg)",
  transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
  boxShadow: "0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.03)",
};
const cardStyles = {
  root: {
    ":hover": {
      transform: "translateY(-5px)",
borderColor: "rgba(239,68,68,0.2)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(239,68,68,0.15), 0 0 40px -8px rgba(239,68,68,0.2)",
    },
  },
};

function EventCard({ e }: { e: EventVM }) {
  const dt = formatDate(e.startsAt);
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  const hasMultiplePrices = (e.ticketTypesCount ?? 0) > 1;
  const priceLabel = hasMultiplePrices ? `від ${money(e.priceCents)} грн` : `${money(e.priceCents)} грн`;
  const cardOpacity = e.isFinished ? 0.78 : 1;
  const cardFilter = e.isFinished ? "grayscale(0.35) saturate(0.8)" : "none";

  return (
    <Card
      withBorder
      padding={0}
      className={`home-event-card${e.isFinished ? " home-event-card-finished" : ""}`}
      style={cardStyle}
      styles={cardStyles}
    >
      <Box component={Link} href={`/events/${e.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {/* Фото — рендеримо після mount, щоб уникнути hydration mismatch через розширення браузера */}
        <Box style={{ width: "100%", background: "rgba(0,0,0,0.35)", position: "relative" }}>
          {e.isFinished ? (
            <>
              <Box
                style={{
                  position: "absolute",
                  top: "34%",
                  left: "-24%",
                  right: "-24%",
                  zIndex: 3,
                  transform: "rotate(-17deg)",
                  background:
                    "repeating-linear-gradient(135deg, #111 0 12px, #f3c623 12px 24px)",
                  color: "#0a0a0a",
                  padding: "9px 0",
                  borderRadius: 2,
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  borderTop: "1px solid rgba(0,0,0,0.65)",
                  borderBottom: "1px solid rgba(0,0,0,0.65)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                  animation: "finishedRibbonShift 7s linear infinite",
                }}
              >
                Завершено
              </Box>
              <Box
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  background:
                    "repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0 10px, rgba(255,255,255,0) 10px 20px), linear-gradient(180deg, rgba(20,20,20,0.16), rgba(20,20,20,0.46))",
                  pointerEvents: "none",
                }}
              />
              <Box
                style={{
                  display: "block",
                  position: "absolute",
                  top: "58%",
                  left: "-22%",
                  right: "-22%",
                  zIndex: 3,
                  transform: "rotate(17deg)",
                  background:
                    "repeating-linear-gradient(135deg, #111 0 12px, #f3c623 12px 24px)",
                  borderTop: "1px solid rgba(0,0,0,0.65)",
                  borderBottom: "1px solid rgba(0,0,0,0.65)",
                  borderRadius: 2,
                  padding: "7px 0",
                  textAlign: "center",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
                  animation: "finishedRibbonShiftReverse 8.5s linear infinite",
                }}
              >
                <Text size="xs" fw={900} style={{ color: "#0a0a0a", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Подія завершена
                </Text>
              </Box>
            </>
          ) : null}
          {e.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={e.posterUrl}
              alt=""
              style={{ width: "100%", height: "auto", display: "block", verticalAlign: "top", maxHeight: 380, objectFit: "contain", objectPosition: "top", opacity: cardOpacity, filter: cardFilter }}
            />
          ) : (
            <AspectRatio ratio={3 / 4} style={{ opacity: cardOpacity, filter: cardFilter }}>
              <PosterFallback seed={e.id} title={e.title} />
            </AspectRatio>
          )}
        </Box>

        {/* Інфо під фото */}
        <Box
          style={{
            padding: "18px 20px",
            background: "var(--card-bg)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Stack gap={10}>
            <Title
              order={4}
              style={{
                margin: 0,
                color: "var(--text)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.3,
                fontSize: "1.05rem",
              }}
            >
              {e.title}
            </Title>
            {e.orgName && (
              <Text size="xs" c="dimmed" style={{ letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.9 }}>
                {e.orgName}
              </Text>
            )}
            {dt && (
              <Group gap={8} wrap="nowrap" align="center">
                <Box style={{ color: "var(--accent)", opacity: 0.85, flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <IconCalendar />
                </Box>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.4 }}>
                  {dt}
                </Text>
              </Group>
            )}
            {place && (
              <Group gap={8} wrap="nowrap" align="center">
                <Box style={{ color: "var(--accent)", opacity: 0.85, flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <IconPin />
                </Box>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.4 }}>
                  {place}
                </Text>
              </Group>
            )}
            <Group justify="space-between" align="center" mt={4}>
              <Text size="md" fw={700} style={{ color: "var(--text)", letterSpacing: "0.02em" }}>
                {priceLabel}
              </Text>
              {e.isFinished ? (
                <Text
                  component="span"
                  size="sm"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background:
                      "repeating-linear-gradient(135deg, rgba(16,16,16,0.95) 0 8px, rgba(243,198,35,0.9) 8px 16px)",
                    border: "1px solid rgba(0,0,0,0.45)",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    color: "#070707",
                  }}
                >
                  Завершено
                </Text>
              ) : (
                <Text
                  component="span"
                  size="sm"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.15) 100%)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    color: "var(--text)",
                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                  }}
                >
                  Квитки →
                </Text>
              )}
            </Group>
          </Stack>
        </Box>
      </Box>
    </Card>
  );
}

function HeroCTAs() {
  const { user, openAuth } = useAuthOpen();
  return (
    <Group gap="md" mt="md" justify="center" wrap="wrap">
      <Link href="#events">
        <Box
          component="span"
          className="btn-glow"
          style={{
            display: "inline-block",
            padding: "14px 28px",
            borderRadius: 8,
            background: "var(--gradient-accent)",
            color: "#030304",
            fontWeight: 700,
            letterSpacing: "0.02em",
            fontSize: 14,
            boxShadow: "0 4px 20px rgba(239,68,68,0.3)",
          }}
        >
          Переглянути афішу
        </Box>
      </Link>
      {user ? (
        <Link href="/my-tickets">
          <Box
            component="span"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 13,
              transition: "border-color 0.2s ease, background 0.2s ease",
            }}
          >
            Мої квитки
          </Box>
        </Link>
      ) : (
        <Box
          component="button"
          type="button"
          onClick={openAuth}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "var(--text)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          Вхід
        </Box>
      )}
    </Group>
  );
}

export default function HomeClient({ events }: { events: EventVM[]; initialUser?: InitialUser }) {
  /* initialValue: true і getInitialValueInEffect: true — сервер і клієнт спочатку обидва рендерять 3 колонки, щоб не було hydration mismatch і стрибка на десктопі */
  const sm = useMediaQuery("(min-width: 36em)", true, { getInitialValueInEffect: true });
  const md = useMediaQuery("(min-width: 48em)", true, { getInitialValueInEffect: true });
  const columnCount = md ? 3 : sm ? 2 : 1;

  const columns = useMemo(() => {
    const cols: EventVM[][] = Array.from({ length: columnCount }, () => []);
    events.forEach((e, i) => cols[i % columnCount].push(e));
    return cols;
  }, [events, columnCount]);

  return (
    <Box style={{ position: "relative", minHeight: "100vh" }}>
      <Stack gap={32}>
      <Box
        id="hero"
        className="hero-glass"
        style={{
          minHeight: "min(58vh, 480px)",
          display: "grid",
          placeItems: "center",
          borderRadius: 20,
          background: "rgba(18,8,8,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <Stack align="center" gap="xl" style={{ padding: "clamp(24px, 4vw, 40px)", textAlign: "center", width: "100%", maxWidth: "min(720px, 92vw)" }}>
          <Box style={{ width: "100%", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero.png"
              alt=""
              style={{ width: "100%", height: "auto", maxHeight: "min(40vh, 340px)", objectFit: "contain", display: "block", verticalAlign: "top" }}
            />
          </Box>
          <Box style={{ overflow: "visible", padding: "4px 0", width: "100%", flexShrink: 0 }}>
            <Title
              order={1}
              style={{
                margin: 0,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1.2,
                fontSize: "clamp(2rem, 5.5vw, 3rem)",
                background: "var(--gradient-text)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Квитки на події
            </Title>
            <Title
              order={1}
              style={{
                margin: "4px 0 0 0",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1.2,
                fontSize: "clamp(2rem, 5.5vw, 3rem)",
                color: "var(--text)",
              }}
            >
              без переплат
            </Title>
          </Box>
          <Text size="lg" style={{ color: "var(--muted)", fontSize: "clamp(1rem, 2.5vw, 1.2rem)", maxWidth: 420 }}>
            Купуй онлайн — швидко та безпечно
          </Text>
          <HeroCTAs />
        </Stack>
      </Box>

      <Box id="events">
        <Group justify="space-between" align="center" mb="xl" wrap="wrap" gap="md">
          <Title order={2} style={{ margin: 0, fontWeight: 900, letterSpacing: "-0.03em", fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>
            Афіша
          </Title>
          {events.length > 0 && (
            <Group gap="xs">
              <Box
                component="span"
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                }}
              >
                За датою
              </Box>
              <Box
                component="span"
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                }}
              >
                Усі події
              </Box>
            </Group>
          )}
        </Group>

        {events.length === 0 ? (
          <Card
            withBorder
            radius="lg"
            padding="xl"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              textAlign: "center",
            }}
          >
            <Title order={3} style={{ margin: 0, color: "var(--text)" }}>
              Наразі немає активних подій
            </Title>
            <Text size="sm" style={{ color: "var(--muted)", marginTop: 10 }}>
              Заходьте пізніше — тут зʼявляться концерти та інші події.
            </Text>
          </Card>
        ) : (
          <Box className="events-masonry">
            {columns.map((col, i) => (
              <Box key={i} className="events-masonry-column">
                {col.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </Box>
            ))}
          </Box>
        )}
      </Box>
      </Stack>
    </Box>
  );
}
