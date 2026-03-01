"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  Stack,
  TextInput,
  Text,
  Title,
  Select,
  Group,
  Divider,
  Paper,
} from "@mantine/core";

type OrgVM = {
  id: string;
  name: string;
  hasMono: boolean;
  jars: { id: string; sendId?: string; title: string }[];
  events: { id: string; title: string; priceCents: number; monoAccountId: string | null; posterUrl: string | null }[];
};

export default function AdminDashboard({ orgs: initialOrgs }: { orgs: OrgVM[] }) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [orgJars, setOrgJars] = useState<Record<string, { id: string; sendId: string | null; title: string }[]>>({});
  const [newOrgName, setNewOrgName] = useState("");
  const [createOrgLoading, setCreateOrgLoading] = useState(false);
  const [createEventOrgId, setCreateEventOrgId] = useState("");
  const [createEventTitle, setCreateEventTitle] = useState("");
  const [createEventPrice, setCreateEventPrice] = useState("");
  const [createEventLoading, setCreateEventLoading] = useState(false);
  const [monoOrgId, setMonoOrgId] = useState("");
  const [monoToken, setMonoToken] = useState("");
  const [monoLoading, setMonoLoading] = useState(false);
  const [jarEventId, setJarEventId] = useState<Record<string, string>>({});
  const [jarLoading, setJarLoading] = useState<Record<string, boolean>>({});
  const [posterLoading, setPosterLoading] = useState<Record<string, boolean>>({});
  const [posterFileKey, setPosterFileKey] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setError("");
    setCreateOrgLoading(true);
    try {
      const res = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Помилка");
      setOrgs((prev) => [...prev, { id: data.id, name: data.name, hasMono: false, jars: [], events: [] }]);
      setNewOrgName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setCreateOrgLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!createEventOrgId || !createEventTitle.trim()) return;
    const price = Math.round(parseFloat(createEventPrice || "0") * 100);
    if (!Number.isFinite(price) || price < 0) return;
    setError("");
    setCreateEventLoading(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: createEventOrgId, title: createEventTitle.trim(), priceCents: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Помилка");
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === createEventOrgId
            ? { ...o, events: [{ id: data.id, title: data.title, priceCents: data.priceCents, monoAccountId: null, posterUrl: null }, ...o.events] }
            : o
        )
      );
      setCreateEventTitle("");
      setCreateEventPrice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setCreateEventLoading(false);
    }
  };

  const handleMonoConnect = async () => {
    if (!monoOrgId || !monoToken.trim()) return;
    setError("");
    setMonoLoading(true);
    try {
      const res = await fetch("/api/admin/mono/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: monoOrgId, token: monoToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.details ?? "Помилка");
      setOrgJars((prev) => ({ ...prev, [monoOrgId]: (data.jars ?? []).map((j: { id: string; sendId?: string; title: string }) => ({ id: j.id, sendId: j.sendId ?? null, title: j.title })) }));
      setOrgs((prev) => prev.map((o) => (o.id === monoOrgId ? { ...o, hasMono: true } : o)));
      setMonoToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setMonoLoading(false);
    }
  };

  const handleUploadPoster = async (eventId: string, file: File) => {
    setPosterLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/events/${eventId}/poster`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Помилка");
      const posterUrl = (data as { posterUrl?: string }).posterUrl ?? null;
      setOrgs((prev) =>
        prev.map((o) => ({
          ...o,
          events: o.events.map((ev) => (ev.id === eventId ? { ...ev, posterUrl } : ev)),
        }))
      );
      setPosterFileKey((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setPosterLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleSetJar = async (eventId: string, jarId: string, sendId: string | null, jarTitle: string | null) => {
    if (!jarId) return;
    setJarLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch("/api/admin/events/set-mono-jar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, jarId, sendId, jarTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Помилка");
      setOrgs((prev) =>
        prev.map((o) => ({
          ...o,
          events: o.events.map((e) => (e.id === eventId ? { ...e, monoAccountId: jarId } : e)),
        }))
      );
      setJarEventId((prev) => ({ ...prev, [eventId]: "" }));
    } finally {
      setJarLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  return (
    <Stack gap="xl" className="admin-dashboard-stack">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Title order={1}>Адмін</Title>
        <Button component={Link} href="/" variant="subtle" color="blue" size="sm">
          ← На головну
        </Button>
      </Group>

      {error && <Text size="sm" c="red">{error}</Text>}

      <Card withBorder p="lg" radius="md">
        <Title order={3} mb="md">Створити організацію</Title>
        <Group align="flex-end" wrap="wrap" gap="sm">
          <TextInput label="Назва" placeholder="Моя організація" value={newOrgName} onChange={(e) => setNewOrgName(e.currentTarget.value)} style={{ flex: "1 1 200px", minWidth: 0 }} />
          <Button onClick={handleCreateOrg} loading={createOrgLoading}>Створити</Button>
        </Group>
      </Card>

      <Card withBorder p="lg" radius="md">
        <Title order={3} mb="md">Створити подію</Title>
        <Stack gap="sm">
          <Select
            label="Організація"
            placeholder="Оберіть організацію"
            data={orgs.map((o) => ({ value: o.id, label: o.name }))}
            value={createEventOrgId}
            onChange={(v) => setCreateEventOrgId(v ?? "")}
          />
          <TextInput label="Назва події" placeholder="Концерт" value={createEventTitle} onChange={(e) => setCreateEventTitle(e.currentTarget.value)} />
          <TextInput label="Ціна (грн)" placeholder="100" value={createEventPrice} onChange={(e) => setCreateEventPrice(e.currentTarget.value)} type="number" min={0} step={0.01} />
          <Button onClick={handleCreateEvent} loading={createEventLoading} disabled={!createEventOrgId || !createEventTitle.trim()}>Створити подію</Button>
        </Stack>
      </Card>

      <Card withBorder p="lg" radius="md">
        <Title order={3} mb="md">Підключити Monobank (банка)</Title>
        <Text size="sm" c="dimmed" mb="sm">Токен з особистого кабінету Monobank (web.monobank.ua) → Налаштування → Токени.</Text>
        <Stack gap="sm">
          <Select
            label="Організація"
            placeholder="Оберіть організацію"
            data={orgs.map((o) => ({ value: o.id, label: o.name }))}
            value={monoOrgId}
            onChange={(v) => setMonoOrgId(v ?? "")}
          />
          <TextInput label="Токен Monobank" type="password" placeholder="u..." value={monoToken} onChange={(e) => setMonoToken(e.currentTarget.value)} />
          <Button onClick={handleMonoConnect} loading={monoLoading} disabled={!monoOrgId || !monoToken.trim()}>Підключити</Button>
        </Stack>
      </Card>

      <Divider />

      <Title order={3}>Організації та події</Title>
      {orgs.length === 0 ? (
        <Text size="sm" c="dimmed">Ще немає організацій. Створіть організацію вище.</Text>
      ) : (
      orgs.map((org) => (
        <Paper key={org.id} withBorder p="lg" radius="md">
          <Group justify="space-between" wrap="wrap" gap="xs" mb="md">
            <Text fw={700}>{org.name}</Text>
            {org.hasMono && <Text size="xs" c="green">Monobank підключено</Text>}
          </Group>
          {org.events.length === 0 ? (
            <Text size="sm" c="dimmed">Немає подій</Text>
          ) : (
            <Stack gap="md">
              {org.events.map((e) => (
                <Box key={e.id}>
                  <Group justify="space-between" wrap="wrap" mb="xs">
                    <Box>
                      <Text fw={600}>{e.title}</Text>
                      <Text size="xs" c="dimmed">{e.priceCents / 100} UAH {e.monoAccountId ? "· Jar привязан" : ""}</Text>
                    </Box>
                    {org.hasMono && (orgJars[org.id]?.length ?? 0) > 0 && (
                      <Group gap="xs">
                        <Select
                          placeholder="Оберіть банку"
                          data={orgJars[org.id].map((j) => ({ value: j.id, label: j.title }))}
                          value={jarEventId[e.id] ?? ""}
                          onChange={(v) => setJarEventId((prev) => ({ ...prev, [e.id]: v ?? "" }))}
                          size="xs"
                          style={{ minWidth: 0, flex: "1 1 140px" }}
                        />
                        <Button size="xs" loading={jarLoading[e.id]} disabled={!jarEventId[e.id]} onClick={() => { const j = orgJars[org.id]?.find((x) => x.id === (jarEventId[e.id] ?? "")); handleSetJar(e.id, jarEventId[e.id] ?? "", j?.sendId ?? null, j?.title ?? null); }}>Привʼязати</Button>
                      </Group>
                    )}
                  </Group>
                  <Group gap="xs" align="flex-end" wrap="wrap">
                    {e.posterUrl && (
                      <Box style={{ width: 56, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </Box>
                    )}
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" fw={500} mb={4} c="dimmed">Постер (фото)</Text>
                      <input
                        key={posterFileKey[e.id] ?? 0}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ fontSize: 14, maxWidth: "100%" }}
                        onChange={(ev) => {
                          const f = ev.target.files?.[0];
                          if (f) handleUploadPoster(e.id, f);
                        }}
                        disabled={posterLoading[e.id]}
                      />
                    </Box>
                    {posterLoading[e.id] && <Text size="xs" c="dimmed">Завантаження…</Text>}
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
          {org.hasMono && !orgJars[org.id]?.length && (
            <Text size="xs" c="dimmed" mt="sm">Підключіть Monobank ще раз, щоб обрати банку для подій.</Text>
          )}
        </Paper>
      )))}
    </Stack>
  );
}
