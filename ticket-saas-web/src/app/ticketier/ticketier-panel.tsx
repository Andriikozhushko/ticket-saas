"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, Group, Select, Stack, Table, Text, Title } from "@mantine/core";
import QRScanner from "./qr-scanner";

type EventItem = { id: string; title: string };
type TicketItem = { id: string; orderId: string; buyerEmail: string; ticketTypeName: string | null; usedAt: string | null; usedBy: string | null };

export default function TicketierPanel() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const fetchMe = async () => {
    const res = await fetch("/api/ticketier/me");
    if (!res.ok) { router.push("/ticketier/login"); return; }
    const data = await res.json();
    setEvents(data.events ?? []);
    if (data.events?.length > 0 && !selectedEventId) setSelectedEventId(data.events[0].id);
  };

  const fetchTickets = async () => {
    if (!selectedEventId) return;
    setTicketsLoading(true);
    setTicketsError(null);
    const res = await fetch(`/api/ticketier/tickets?eventId=${encodeURIComponent(selectedEventId)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTicketsError((data as { error?: string }).error ?? "Не вдалося завантажити квитки");
      setTickets([]);
    } else {
      const data = await res.json();
      setTickets(data.tickets ?? []);
    }
    setTicketsLoading(false);
  };

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchTickets();
    else setTickets([]);
  }, [selectedEventId]);

  const handleScan = async (ticketId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch("/api/ticketier/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Помилка" };
    await fetchTickets();
    return { ok: true };
  };

  const handleLogout = async () => {
    await fetch("/api/ticketier/logout", { method: "POST" });
    router.push("/ticketier/login");
    router.refresh();
  };

  if (loading) return <Box p="xl"><Text>Завантаження…</Text></Box>;

  return (
    <Box className="ticketier-page">
      <Group justify="space-between" mb="lg" wrap="wrap" gap="sm">
        <Title order={2} style={{ fontSize: "clamp(1.25rem, 4vw, 1.5rem)" }}>Панель білетника</Title>
        <Button variant="subtle" size="sm" onClick={handleLogout}>Вийти</Button>
      </Group>

      {events.length === 0 ? (
        <Card withBorder p="xl">
          <Text c="dimmed">Вам ще не призначено жодної події. Зверніться до організатора.</Text>
        </Card>
      ) : (
        <Stack gap="lg">
          <Select
            label="Подія"
            data={events.map((e) => ({ value: e.id, label: e.title }))}
            value={selectedEventId}
            onChange={(v) => setSelectedEventId(v)}
          />

          {selectedEventId && (
            <>
              <Card withBorder p="lg" className="ticketier-scanner-card">
                <Text fw={600} mb="md" size="lg">Сканувати QR-код квитка</Text>
                <Box className="ticketier-scanner-video-wrap">
                  <QRScanner onScan={handleScan} />
                </Box>
              </Card>

              <Card withBorder p="lg">
                <Text fw={600} mb="md">Куплені квитки ({tickets.length})</Text>
                {ticketsError && <Text size="sm" c="red" mb="xs">{ticketsError}</Text>}
                {ticketsLoading ? (
                  <Text size="sm" c="dimmed">Завантаження квитків…</Text>
                ) : tickets.length === 0 ? (
                  <Text size="sm" c="dimmed">Поки немає оплачених квитків</Text>
                ) : (
                  <Box className="ticketier-table-wrap">
                  <Table striped withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Email</Table.Th>
                        <Table.Th>Тип</Table.Th>
                        <Table.Th>Статус</Table.Th>
                        <Table.Th>Скановано</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {tickets.map((t) => (
                        <Table.Tr key={t.id}>
                          <Table.Td>{t.buyerEmail}</Table.Td>
                          <Table.Td>{t.ticketTypeName ?? "—"}</Table.Td>
                          <Table.Td>
                            {t.usedAt ? (
                              <Text size="sm" c="red">Використано</Text>
                            ) : (
                              <Text size="sm" c="green">Активний</Text>
                            )}
                          </Table.Td>
                          <Table.Td>{t.usedAt ? `${t.usedBy ?? ""} ${new Date(t.usedAt).toLocaleString("uk-UA")}` : "—"}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                  </Box>
                )}
                <Button variant="light" size="xs" mt="md" onClick={fetchTickets} loading={ticketsLoading}>Оновити список</Button>
              </Card>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
