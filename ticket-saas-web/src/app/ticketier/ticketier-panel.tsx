"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, Group, Select, Stack, Text } from "@mantine/core";
import QRScanner from "./qr-scanner";

type EventItem = { id: string; title: string };
type TicketItem = {
  id: string;
  orderId: string;
  buyerEmail: string;
  ticketTypeName: string | null;
  usedAt: string | null;
  usedBy: string | null;
};

type ScanResult = {
  ok: boolean;
  error?: string;
  usedAt?: string | null;
  usedBy?: string | null;
  buyerEmail?: string | null;
  ticketTypeName?: string | null;
  state?: "success" | "already_used" | "error";
};

export default function TicketierPanel() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [showTickets, setShowTickets] = useState(false);

  const fetchMe = useCallback(async () => {
    const res = await fetch("/api/ticketier/me");
    if (!res.ok) {
      router.push("/ticketier/login");
      return;
    }

    const data = await res.json();
    setEvents(data.events ?? []);
    setSelectedEventId((current) => current ?? data.events?.[0]?.id ?? null);
  }, [router]);

  const fetchTickets = useCallback(async () => {
    if (!selectedEventId) return;

    setTicketsLoading(true);
    setTicketsError(null);

    const res = await fetch(`/api/ticketier/tickets?eventId=${encodeURIComponent(selectedEventId)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTicketsError((data as { error?: string }).error ?? "Не вдалося завантажити квитки");
      setTickets([]);
      setTicketsLoading(false);
      return;
    }

    const data = await res.json();
    setTickets(data.tickets ?? []);
    setTicketsLoading(false);
  }, [selectedEventId]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      await fetchMe();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [fetchMe]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedEventId) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      if (!cancelled) {
        await fetchTickets();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEventId, fetchTickets]);

  const handleScan = async (ticketId: string): Promise<ScanResult> => {
    const res = await fetch("/api/ticketier/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    });

    const data = await res.json().catch(() => ({}));
    await fetchTickets();

    const payload = data as ScanResult;
    if (!res.ok) {
      return {
        ok: false,
        error: payload.error ?? "Помилка",
        usedAt: payload.usedAt,
        usedBy: payload.usedBy,
        buyerEmail: payload.buyerEmail,
        ticketTypeName: payload.ticketTypeName,
        state: payload.state ?? "error",
      };
    }

    return {
      ok: true,
      usedAt: payload.usedAt,
      usedBy: payload.usedBy,
      buyerEmail: payload.buyerEmail,
      ticketTypeName: payload.ticketTypeName,
      state: payload.state ?? "success",
    };
  };

  const handleLogout = async () => {
    await fetch("/api/ticketier/logout", { method: "POST" });
    router.push("/ticketier/login");
    router.refresh();
  };

  if (loading) {
    return (
      <Box p="xl">
        <Text>Завантаження...</Text>
      </Box>
    );
  }

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const scannedCount = tickets.filter((ticket) => ticket.usedAt).length;
  const activeCount = tickets.length - scannedCount;
  const recentTickets = [...tickets]
    .sort((a, b) => {
      if (a.usedAt && b.usedAt) return new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime();
      if (a.usedAt) return -1;
      if (b.usedAt) return 1;
      return a.buyerEmail.localeCompare(b.buyerEmail);
    })
    .slice(0, 8);

  return (
    <Box className="ticketier-page ticketier-mobile-page">
      {events.length === 0 ? (
        <Card withBorder p="xl" className="ticketier-empty-card">
          <Text fw={700} mb="sm">
            Немає призначених подій
          </Text>
          <Text c="dimmed">Вам ще не призначено жодної події. Зверніться до організатора.</Text>
        </Card>
      ) : (
        <Stack gap="md">
          <Box className="ticketier-mobile-stage">
            <Box className="ticketier-mobile-topbar">
              <Box>
                <Text className="ticketier-mobile-label">Сканер квитків</Text>
                <Text className="ticketier-mobile-event-heading">{selectedEvent?.title ?? "Оберіть подію"}</Text>
              </Box>
              <Button variant="subtle" color="gray" size="compact-sm" onClick={handleLogout}>
                Вийти
              </Button>
            </Box>

            {selectedEventId ? <QRScanner onScan={handleScan} fileInputRef={fileInputRef} /> : null}

            <Box className="ticketier-mobile-dock">
              <Box className="ticketier-mobile-dock-main">
                <Select
                  aria-label="Подія"
                  data={events.map((event) => ({ value: event.id, label: event.title }))}
                  value={selectedEventId}
                  onChange={(value) => {
                    setTickets([]);
                    setSelectedEventId(value);
                  }}
                  className="ticketier-event-select"
                  comboboxProps={{ withinPortal: false }}
                />
              </Box>

              <Box className="ticketier-mobile-dock-stats">
                <Box className="ticketier-stat-chip">
                  <Text className="ticketier-stat-value">{activeCount}</Text>
                  <Text className="ticketier-stat-label">активних</Text>
                </Box>
                <Box className="ticketier-stat-chip ticketier-stat-chip-used">
                  <Text className="ticketier-stat-value">{scannedCount}</Text>
                  <Text className="ticketier-stat-label">використано</Text>
                </Box>
              </Box>

              <Group grow className="ticketier-mobile-dock-actions">
                <Button variant="light" color="gray" size="sm" onClick={() => setShowTickets((current) => !current)}>
                  {showTickets ? "Сховати список" : "Список"}
                </Button>
              </Group>
            </Box>
          </Box>

          {showTickets ? (
            <Card withBorder p="lg" className="ticketier-list-card">
              <Group justify="space-between" align="center" mb="md">
                <Box>
                  <Text fw={700}>Останні квитки</Text>
                  <Text size="sm" c="dimmed">
                    {tickets.length > 0 ? `Усього оплачено: ${tickets.length}` : "Список оновлюється після кожного скану"}
                  </Text>
                </Box>
                <Button variant="light" size="xs" onClick={fetchTickets} loading={ticketsLoading}>
                  Оновити
                </Button>
              </Group>

              {ticketsError ? (
                <Text size="sm" c="red" mb="xs">
                  {ticketsError}
                </Text>
              ) : null}

              {ticketsLoading ? (
                <Text size="sm" c="dimmed">
                  Завантаження квитків...
                </Text>
              ) : recentTickets.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Поки немає оплачених квитків.
                </Text>
              ) : (
                <Stack gap="sm">
                  {recentTickets.map((ticket) => (
                    <Box key={ticket.id} className="ticketier-ticket-row">
                      <Box>
                        <Text fw={600}>{ticket.buyerEmail}</Text>
                        <Text size="sm" c="dimmed">
                          {ticket.ticketTypeName ?? "Без окремого типу"}
                        </Text>
                      </Box>
                      <Box ta="right">
                        <Text size="sm" c={ticket.usedAt ? "yellow" : "green"} fw={700}>
                          {ticket.usedAt ? "Використано" : "Активний"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {ticket.usedAt ? new Date(ticket.usedAt).toLocaleString("uk-UA") : "Ще не сканували"}
                        </Text>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
