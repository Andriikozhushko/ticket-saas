import { headers } from "next/headers";
import Link from "next/link";
import { Box, Card, Stack, Text, Title, Group } from "@mantine/core";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildQrImageUrl } from "@/lib/qr";
import { IconCalendar, IconClock, IconPin } from "@/components/icons";

function formatDateOnly(d: Date) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(d);
}
function formatTimeOnly(d: Date) {
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(d);
}

export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  const session = await getSessionFromCookie();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${proto}://${host}` : "";

  const orders = session?.email
    ? await prisma.order.findMany({
        where: {
          buyerEmail: session.email.toLowerCase(),
          status: "paid",
          tickets: { some: {} },
        },
        include: {
          tickets: true,
          event: { select: { id: true, title: true, startsAt: true, venue: true, city: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  if (!session?.email) {
    return (
      <Stack gap="xl">
        <Title order={1} style={{ fontWeight: 800 }}>Мої квитки</Title>
        <Card withBorder padding="xl" radius="lg" style={{ borderColor: "var(--border)", background: "var(--gradient-card)" }}>
          <Text c="dimmed" ta="center">Увійдіть, щоб переглянути свої квитки.</Text>
          <Text size="sm" c="dimmed" ta="center" mt="sm">
            <Link href="/" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }}>На головну</Link>
          </Text>
        </Card>
      </Stack>
    );
  }

  return (
    <Box className="my-tickets-page" style={{ minHeight: "100%" }}>
      <Stack gap="xl" p="md" style={{ width: "100%", maxWidth: 960 }} mx="auto">
        <Box>
          <Title order={1} mb="xs" style={{ fontWeight: 800 }}>Мої квитки</Title>
          <Text size="sm" c="dimmed">Квитки, оплачені з {session.email}</Text>
        </Box>

        {orders.length === 0 ? (
          <Card withBorder padding="xl" radius="lg" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgb(18,18,24)" }}>
            <Text c="dimmed" ta="center">У вас поки немає оплачених квитків.</Text>
            <Text size="sm" c="dimmed" ta="center" mt="sm">
              <Link href="/" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }}>Перейти до афіши</Link>
            </Text>
          </Card>
        ) : (
          <Stack gap="lg">
            {orders.map((order) => {
              const event = order.event;
              const ticketList = order.tickets;
              const venueLine = [event.city, event.venue].filter(Boolean).join(", ");
              return (
                <Card
                  key={order.id}
                  withBorder
                  padding="lg"
                  radius="lg"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgb(18,18,24)" }}
                >
                  {/* Блок події (дата, місце, час) — вище блоку квитків */}
                  <Box mb="lg">
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: "0.05em" }}>Подія</Text>
                    <Title order={3} style={{ margin: 0, marginBottom: 12, fontWeight: 800 }}>
                      {event.title}
                    </Title>
                    <Stack gap={6} mt="sm">
                      {event.startsAt && (
                        <>
                          <Group gap={8} align="center">
                            <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconCalendar size={16} /></Box>
                            <Text size="sm" c="dimmed">{formatDateOnly(event.startsAt)}</Text>
                          </Group>
                          <Group gap={8} align="center">
                            <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconClock size={16} /></Box>
                            <Text size="sm" c="dimmed">{formatTimeOnly(event.startsAt)}</Text>
                          </Group>
                        </>
                      )}
                      {venueLine ? (
                        <Group gap={8} align="center">
                          <Box style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><IconPin size={16} /></Box>
                          <Text size="sm" c="dimmed">{venueLine}</Text>
                        </Group>
                      ) : null}
                    </Stack>
                    <Box
                      component="span"
                      style={{
                        display: "inline-block",
                        marginTop: 12,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.35)",
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.95)",
                      }}
                    >
                      Оплачено
                    </Box>
                    <Box mt="sm">
                      <Link
                        href={`/orders/${order.id}`}
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--accent)",
                          textDecoration: "underline",
                        }}
                      >
                        Відкрити замовлення →
                      </Link>
                    </Box>
                  </Box>

                  {/* Блок квитків (QR) — нижче; на вузьких екранах QR вміщується по ширині */}
                  <Box>
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: "0.05em" }}>Квитки</Text>
                    {ticketList.length > 0 ? (
                      <Box style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                        {ticketList.map((ticket, i) => {
                          const verifyUrl = origin ? `${origin}/api/public/tickets/verify/${ticket.id}` : "";
                          return verifyUrl ? (
                            <Box
                              key={ticket.id}
                              className="my-tickets-qr-wrap"
                              style={{
                                padding: 14,
                                background: "white",
                                borderRadius: 12,
                                border: "1px solid var(--border)",
                                width: "100%",
                                maxWidth: 220,
                                minWidth: 0,
                                boxSizing: "border-box",
                              }}
                            >
                              {ticketList.length > 1 && (
                                <Text size="xs" fw={600} c="dimmed" mb={4}>Квиток {i + 1}</Text>
                              )}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={buildQrImageUrl(origin, verifyUrl, 200)}
                                alt={ticketList.length > 1 ? `QR квитка ${i + 1}` : "QR квитка"}
                                width={200}
                                height={200}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  height: "auto",
                                  maxWidth: "100%",
                                  minWidth: 0,
                                }}
                              />
                            </Box>
                          ) : null;
                        })}
                      </Box>
                    ) : null}
                    <Text size="xs" c="dimmed" mt="sm">Покажіть QR на вході на подію</Text>
                  </Box>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
