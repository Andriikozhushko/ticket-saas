"use client";

import { useCallback, useEffect, useState } from "react";
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

  const fetchList = useCallback(async () => {
    const res = await fetch(`/api/admin/orgs/${orgId}/ticketiers`);
    if (!res.ok) {
      setListError("РќРµ РІРґР°Р»ося Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё список");
      setList([]);
      return;
    }
    setListError(null);
    const data = await res.json();
    setList(data);
  }, [orgId]);

  useEffect(() => {
    fetchList().finally(() => setLoading(false));
  }, [fetchList]);

  const isAssigned = (ticketier: TicketierRow) => ticketier.eventIds.includes(eventId);

  const assign = async (ticketierId: string) => {
    setActionError(null);
    const res = await fetch(`/api/admin/ticketiers/${ticketierId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? "РќРµ РІРґР°Р»ося РїСЂРёР·РЅР°С‡РёС‚Рё");
      return;
    }
    fetchList();
  };

  const unassign = async (ticketierId: string) => {
    setActionError(null);
    const res = await fetch(
      `/api/admin/ticketiers/${ticketierId}/events?eventId=${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error ?? "РќРµ РІРґР°Р»ося РїСЂРёР±СЂР°С‚Рё");
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
        setCreateError((data as { error?: string }).error ?? "РџРѕРјРёР»РєР°");
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
      <Text size="sm" fw={600} mb="xs">
        Р‘С–Р»РµС‚РЅРёРєРё
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        РЎС‚РІРѕСЂС–С‚ь РѕР±Р»С–РєРѕРІС– Р·Р°писи РґР»я Р±С–Р»РµС‚РЅРёРєС–РІ С– РїСЂРёР·РЅР°С‡С‚Рµ С—С… РЅР° С†СЋ РїРѕРґС–СЋ. Р’РѕРЅРё Р·РјРѕР¶СѓС‚ь СЃРєР°РЅСѓРІР°С‚Рё QR РЅР° РІС…РѕРґС–.
      </Text>
      {listError && <Text size="sm" c="red" mb="xs">{listError}</Text>}
      {actionError && <Text size="sm" c="red" mb="xs">{actionError}</Text>}
      {loading ? (
        <Text size="sm" c="dimmed">Р—Р°РІР°РЅС‚Р°Р¶Рµння...</Text>
      ) : (
        <Stack gap="sm">
          {list.map((ticketier) => (
            <Group key={ticketier.id} justify="space-between">
              <Text size="sm">
                {ticketier.login} {ticketier.displayName ? `(${ticketier.displayName})` : ""}
              </Text>
              {isAssigned(ticketier) ? (
                <Button size="xs" variant="subtle" color="red" onClick={() => unassign(ticketier.id)}>
                  РџСЂРёР±СЂР°С‚Рё Р· РїРѕРґС–С—
                </Button>
              ) : (
                <Button size="xs" variant="light" onClick={() => assign(ticketier.id)}>
                  Р”РѕРґР°С‚Рё РґРѕ РїРѕРґС–С—
                </Button>
              )}
            </Group>
          ))}
          <Card withBorder p="sm" radius="md">
            <Text size="xs" fw={500} mb="xs">
              РќРѕРІРёР№ Р±С–Р»РµС‚РЅРёРє
            </Text>
            <Group gap="xs" align="flex-end">
              <TextInput placeholder="Р›РѕРіС–РЅ" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} size="xs" />
              <TextInput
                type="password"
                placeholder="РџР°СЂРѕР»ь (РјС–РЅ. 6)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                size="xs"
              />
              <Button size="xs" onClick={createTicketier} loading={createLoading} disabled={!newLogin.trim() || newPassword.length < 6}>
                РЎС‚РІРѕСЂРёС‚Рё С– РїСЂРёР·РЅР°С‡РёС‚Рё
              </Button>
            </Group>
            {createError && <Text size="xs" c="red" mt="xs">{createError}</Text>}
          </Card>
        </Stack>
      )}
    </Box>
  );
}

