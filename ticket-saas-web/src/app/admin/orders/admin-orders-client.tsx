"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Title,
  Table,
  Select,
  TextInput,
  Button,
  Group,
  Text,
  Badge,
  Stack,
  Paper,
} from "@mantine/core";

export type OrderRow = {
  id: string;
  buyerEmail: string;
  amountExpectedCents: number;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  eventId: string;
  eventTitle: string;
  orgName: string;
  payment: { id: string; amountCents: number; occurredAt: string } | null;
  ticketsCount: number;
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

const STATUS_OPTIONS = [
  { value: "awaiting_payment", label: "Очікує оплати" },
  { value: "paid", label: "Оплачено" },
  { value: "expired", label: "Час вийшов" },
];

export default function AdminOrdersClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { status?: string; expiresAt?: string; createdAt?: string }>>({});

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders");
      if (res.status === 403) {
        setOrders([]);
        return;
      }
      if (!res.ok) throw new Error("Не вдалося завантажити");
      const data = await res.json();
      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const getEdit = (id: string) => edits[id] ?? {};
  const setEdit = (id: string, patch: { status?: string; expiresAt?: string; createdAt?: string }) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (order: OrderRow) => {
    const e = getEdit(order.id);
    if (!e.status && !e.expiresAt && e.createdAt === undefined) return;
    setSavingId(order.id);
    setError(null);
    try {
      const body: { status?: string; expiresAt?: string; createdAt?: string } = {};
      if (e.status) body.status = e.status;
      if (e.expiresAt) body.expiresAt = new Date(e.expiresAt).toISOString();
      if (e.createdAt !== undefined) body.createdAt = new Date(e.createdAt).toISOString();
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Помилка збереження");
      }
      setEdits((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setSavingId(null);
    }
  };

  if (orders.length === 0 && !loading) {
    return (
      <Box style={{ maxWidth: 1200, width: "100%" }}>
        <Title order={2} mb="xl">Замовлення</Title>
        <Paper p="xl" radius="lg" withBorder>
          <Text c="dimmed">Замовлень немає або немає доступу.</Text>
        </Paper>
      </Box>
    );
  }

  return (
    <Box style={{ maxWidth: 1400, width: "100%", minWidth: 0 }}>
      <Group justify="space-between" mb="xl" wrap="wrap" gap="sm">
        <Title order={2}>Замовлення</Title>
        <Button variant="light" size="sm" onClick={fetchOrders} loading={loading}>
          Оновити
        </Button>
      </Group>
      {error && (
        <Paper p="sm" mb="md" radius="md" withBorder style={{ borderColor: "var(--mantine-color-red-6)" }}>
          <Text size="sm" c="red">{error}</Text>
        </Paper>
      )}
      <Paper withBorder radius="lg" style={{ overflow: "auto" }}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Подія / орг</Table.Th>
              <Table.Th>Сума</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th>Термін оплати</Table.Th>
              <Table.Th>Створено</Table.Th>
              <Table.Th>Оплата</Table.Th>
              <Table.Th>Дії</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((o) => {
              const e = getEdit(o.id);
              const hasEdit = e.status || e.expiresAt || e.createdAt !== undefined;
              return (
                <Table.Tr key={o.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{o.buyerEmail}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">{o.eventTitle}</Text>
                      <Text size="xs" c="dimmed">{o.orgName}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{(o.amountExpectedCents / 100).toFixed(2)} грн</Text>
                    {o.quantity > 1 && <Text size="xs" c="dimmed">× {o.quantity}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      data={STATUS_OPTIONS}
                      value={e.status ?? o.status}
                      onChange={(v) => setEdit(o.id, { ...e, status: v ?? undefined })}
                      styles={{ input: { minWidth: 140 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      type="datetime-local"
                      size="xs"
                      value={e.expiresAt ?? toDatetimeLocal(o.expiresAt)}
                      onChange={(ev) => setEdit(o.id, { ...e, expiresAt: ev.target.value || undefined })}
                      style={{ width: 180 }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      type="datetime-local"
                      size="xs"
                      value={e.createdAt !== undefined ? e.createdAt : toDatetimeLocal(o.createdAt)}
                      onChange={(ev) => setEdit(o.id, { ...e, createdAt: ev.target.value || undefined })}
                      style={{ width: 180 }}
                    />
                  </Table.Td>
                  <Table.Td>
                    {o.payment ? (
                      <Badge size="sm" color="green">Оплата {(o.payment.amountCents / 100).toFixed(0)} грн</Badge>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                    {o.ticketsCount > 0 && (
                      <Text size="xs" c="dimmed">Квитків: {o.ticketsCount}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      disabled={!hasEdit}
                      loading={savingId === o.id}
                      onClick={() => handleSave(o)}
                    >
                      Зберегти
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
    </Box>
  );
}
