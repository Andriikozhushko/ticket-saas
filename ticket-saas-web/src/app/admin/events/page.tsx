import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import ApproveEventButton from "./approve-event-button";
import DeleteEventButton from "./delete-event-button";
import ToggleFinishedButton from "./toggle-finished-button";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(d);
}

export default async function AdminEventsPage() {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) redirect("/");

  const orgs = await prisma.organization.findMany({
    where: session.isAdmin ? undefined : { ownerId: session.userId },
    select: { id: true },
  });
  const orgIds = orgs.length > 0 ? orgs.map((o) => o.id) : [];
  const events = await prisma.event.findMany({
    where: orgIds.length > 0 ? { orgId: { in: orgIds } } : undefined,
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const eventIds = events.map((e) => e.id);
  const ticketTypesByEvent =
    eventIds.length > 0
      ? await prisma.ticketType.findMany({
          where: { eventId: { in: eventIds } },
          orderBy: [{ eventId: "asc" }, { sortOrder: "asc" }],
        })
      : [];
  const ticketTypesMap = new Map<string, { name: string; priceCents: number }[]>();
  for (const t of ticketTypesByEvent) {
    const list = ticketTypesMap.get(t.eventId) ?? [];
    list.push({ name: t.name, priceCents: t.priceCents });
    ticketTypesMap.set(t.eventId, list);
  }

  return (
    <Box style={{ maxWidth: 1200, width: "100%", minWidth: 0 }}>
      <Group justify="space-between" mb="xl" wrap="wrap" gap="sm">
        <Title order={2}>Події</Title>
        <Link href="/admin/events/new">
          <Button size="md">+ Нова подія</Button>
        </Link>
      </Group>

      {events.length === 0 ? (
        <Card withBorder p="xl" radius="lg">
          <Stack align="center" gap="md">
            <Text c="dimmed" ta="center">Подій поки немає.</Text>
            <Link href="/admin/events/new">
              <Button variant="light" size="md">Створити подію</Button>
            </Link>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {events.map((e) => {
            const status = (e as { status?: string }).status;
            const isApproved = (status ?? "approved") === "approved";
            const ticketTypes = ticketTypesMap.get(e.id) ?? [];
            const priceText =
              ticketTypes.length > 0
                ? ticketTypes.map((t) => `${t.name}: ${(t.priceCents / 100).toFixed(0)} грн`).join(" · ")
                : `${(e.priceCents / 100).toFixed(0)} грн`;
            return (
              <Card key={e.id} withBorder padding="lg" radius="lg" style={{ display: "flex", flexDirection: "column" }}>
                {e.posterUrl && (
                  <Box mb="md" style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/10", background: "var(--panel)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.posterUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </Box>
                )}
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed">{e.org.name}</Text>
                  <Group gap={6}>
                    <Badge size="sm" color={isApproved ? "green" : "yellow"} variant="light">
                      {isApproved ? "Одобрено" : "На модерації"}
                    </Badge>
                    {e.isFinished ? <Badge size="sm" color="gray" variant="light">Завершено</Badge> : null}
                  </Group>
                </Group>
                <Title order={4} lineClamp={2} mb={4}>{e.title}</Title>
                <Text size="sm" c="dimmed" mb="xs">{formatDate(e.startsAt)}</Text>
                {(e.venue || e.city) && (
                  <Text size="sm" c="dimmed" mb="xs">{[e.venue, e.city].filter(Boolean).join(", ")}</Text>
                )}
                <Text size="sm" fw={500} mb="md">{priceText}</Text>
                <Group gap="xs" mt="auto" wrap="wrap">
                  {!isApproved && session.isAdmin && <ApproveEventButton eventId={e.id} />}
                  <ToggleFinishedButton eventId={e.id} isFinished={e.isFinished} />
                  <Link href={`/admin/events/${e.id}`}>
                    <Button variant="light" size="xs">Редагувати</Button>
                  </Link>
                  <Link href={`/events/${e.id}`} target="_blank">
                    <Button variant="subtle" size="xs">Відкрити</Button>
                  </Link>
                  <DeleteEventButton eventId={e.id} eventTitle={e.title} />
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}
