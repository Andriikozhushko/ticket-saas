"use client";

import { useEffect, useState } from "react";
import { Box, Button, Card, Group, Stack, Text, TextInput } from "@mantine/core";

type TicketierRow = { id: string; login: string; displayName: string | null; eventIds: string[] };

export default function EventTicketiersBlock({ eventId, orgId }: { eventId: string; orgId: string }) {
  const [list, setList] = useState<TicketierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchList = async () => {
    const res = await fetch(`/api/admin/orgs/${orgId}/ticketiers`);
    if (!res.ok) {
      setListError("Не вдалося завантажити список");
      setList([]);
      return;
    }
    setListError(null);
    const data = await res.json();
    setList(data);
  };

  useEffect(() => {
    fetchList().finally(() => setLoading(false));
  }, [orgId]);

  const isAssigned = (t: TicketierRow) => t.eventIds.includes(eventId);

  const assign = async (ticketierId: string) => {
    setActionError(null);
    const res = await fetch(`/api/admin/ticketiers/${ticketierId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? "Не вдалося призначити");
      return;
    }
    fetchList();
  };

  const unassign = async (ticketierId: string) => {
    setActionError(null);
    const res = await fetch(`/api/admin/ticketiers/${ticketierId}/events?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? "Не вдалося прибрати");
      return;
    }
    fetchList();
  };

  const createTicketier = async () => {
    if (!newLogin.trim() || !newPassword.trim()) return;
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/ticketiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, login: newLogin.trim(), password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError((data as { error?: string }).error ?? "Помилка");
        return;
      }
      const id = (data as { id?: string }).id;
      if (id) await assign(id);
      setNewLogin("");
      setNewPassword("");
      fetchList();
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <Box pt="md" style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}>
      <Text size="sm" fw={600} mb="xs">Білетники</Text>
      <Text size="xs" c="dimmed" mb="sm">Створіть облікові записи для білетників і призначте їх на цю подію. Вони зможуть сканувати QR на вході.</Text>
      {listError && <Text size="sm" c="red" mb="xs">{listError}</Text>}
      {actionError && <Text size="sm" c="red" mb="xs">{actionError}</Text>}
      {loading ? (
        <Text size="sm" c="dimmed">Завантаження…</Text>
      ) : (
        <Stack gap="sm">
          {list.map((t) => (
            <Group key={t.id} justify="space-between">
              <Text size="sm">{t.login} {t.displayName ? `(${t.displayName})` : ""}</Text>
              {isAssigned(t) ? (
                <Button size="xs" variant="subtle" color="red" onClick={() => unassign(t.id)}>Прибрати з події</Button>
              ) : (
                <Button size="xs" variant="light" onClick={() => assign(t.id)}>Додати до події</Button>
              )}
            </Group>
          ))}
          <Card withBorder p="sm" radius="md">
            <Text size="xs" fw={500} mb="xs">Новий білетник</Text>
            <Group gap="xs" align="flex-end">
              <TextInput placeholder="Логін" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} size="xs" />
              <TextInput type="password" placeholder="Пароль (мін. 6)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} size="xs" />
              <Button size="xs" onClick={createTicketier} loading={createLoading} disabled={!newLogin.trim() || newPassword.length < 6}>
                Створити і призначити
              </Button>
            </Group>
            {createError && <Text size="xs" c="red" mt="xs">{createError}</Text>}
          </Card>
        </Stack>
      )}
    </Box>
  );
}
