"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Select,
} from "@mantine/core";
import EventTicketiersBlock from "./event-ticketiers-block";
import DeleteEventButton from "./delete-event-button";
import IssueTicketsBlock from "./issue-tickets-block";

type Org = { id: string; name: string };
type TicketTypeRow = { name: string; priceCents: string };
type Jar = { id: string; sendId: string; title: string };

type EventFormProps = {
  orgs: Org[];
  event?: {
    id: string;
    title: string;
    priceCents?: number;
    startsAt: string | null;
    venue: string | null;
    city: string | null;
    posterUrl: string | null;
    organizerPhotoUrl: string | null;
    description: string | null;
    orgId: string;
    ticketTypes: { id: string; name: string; priceCents: number }[];
  };
};

function toDateLocal(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toTimeLocal(d: Date | null): string {
  if (!d) return "19:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function EventForm({ orgs, event }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title ?? "");
  const [orgId, setOrgId] = useState(event?.orgId ?? orgs[0]?.id ?? "");
  const [date, setDate] = useState(() => (event?.startsAt ? toDateLocal(new Date(event.startsAt)) : ""));
  const [time, setTime] = useState(() => (event?.startsAt ? toTimeLocal(new Date(event.startsAt)) : "19:00"));
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [city, setCity] = useState(event?.city ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [ticketRows, setTicketRows] = useState<TicketTypeRow[]>(
    event?.ticketTypes?.length
      ? event.ticketTypes.map((t) => ({ name: t.name, priceCents: String(t.priceCents / 100) }))
      : [{ name: "Стандарт", priceCents: String((event?.priceCents ?? 10000) / 100) }]
  );
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [jars, setJars] = useState<Jar[]>([]);
  const [jarId, setJarId] = useState<string | null>(null);
  const [jarsLoading, setJarsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadLoading, setUploadLoading] = useState<"poster" | "organizer" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit || !orgId) {
      setJars([]);
      setJarId(null);
      return;
    }
    setJarsLoading(true);
    setJarId(null);
    fetch(`/api/admin/orgs/${orgId}/jars`)
      .then((r) => r.json())
      .then((data: { jars?: Jar[] }) => setJars(data.jars ?? []))
      .catch(() => setJars([]))
      .finally(() => setJarsLoading(false));
  }, [orgId, isEdit]);

  const POSTER_MAX_MB = 10;
  const POSTER_MAX_BYTES = POSTER_MAX_MB * 1024 * 1024;

  const addTicketRow = () => setTicketRows((r) => [...r, { name: "", priceCents: "" }]);
  const removeTicketRow = (i: number) => setTicketRows((r) => r.filter((_, j) => j !== i));
  const updateTicketRow = (i: number, field: "name" | "priceCents", value: string) => {
    setTicketRows((r) => r.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  };

  const buildStartsAt = (): string | null => {
    if (!date || !time) return null;
    return `${date}T${time}:00+02:00`;
  };

  const handleSubmit = async () => {
    setError("");
    if (!isEdit && (orgs.length === 0 || !orgId)) {
      setError("Спочатку створіть організацію");
      return;
    }
    if (!title.trim()) {
      setError("Введіть назву події");
      return;
    }
    if (!date || !time) {
      setError("Вкажіть дату та час події");
      return;
    }
    if (!city.trim()) {
      setError("Вкажіть місто");
      return;
    }
    if (!venue.trim()) {
      setError("Вкажіть майданчик");
      return;
    }
    if (!description.trim()) {
      setError("Вкажіть опис події");
      return;
    }
    const ticketTypes = ticketRows
      .map((r) => ({
        name: r.name.trim(),
        priceCents: Math.round(parseFloat(r.priceCents || "0") * 100),
      }))
      .filter((t) => t.name && Number.isFinite(t.priceCents) && t.priceCents >= 0);
    if (ticketTypes.length === 0) {
      setError("Додайте хоча б один вид квитка (назва та ціна)");
      return;
    }
    if (!isEdit) {
      const selectedJar = jars.find((j) => j.id === jarId);
      if (!selectedJar) {
        setError("Оберіть банку (Monobank) для прийому оплат за квитки");
        return;
      }
    }
    if (!isEdit && !posterFile) {
      setError("Додайте фото для афіши (постер події)");
      return;
    }
    if (posterFile && posterFile.size > POSTER_MAX_BYTES) {
      setError(`Фото афіши: макс. ${POSTER_MAX_MB} МБ`);
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/events/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            startsAt: buildStartsAt(),
            venue: venue.trim(),
            city: city.trim(),
            description: description.trim(),
            ticketTypes,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "Помилка");
        }
        router.push("/admin/events");
        router.refresh();
      } else {
        const selectedJar = jars.find((j) => j.id === jarId);
        if (!selectedJar) {
          setError("Оберіть банку (Monobank) для прийому оплат");
          return;
        }
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId,
            title: title.trim(),
            startsAt: buildStartsAt(),
            venue: venue.trim(),
            city: city.trim(),
            description: description.trim(),
            ticketTypes,
            jarId: selectedJar.id,
            sendId: selectedJar.sendId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Помилка");
        const newId = (data as { id?: string }).id;
        if (posterFile && newId) {
          const fd = new FormData();
          fd.append("file", posterFile);
          const posterRes = await fetch(`/api/admin/events/${newId}/poster`, { method: "POST", body: fd });
          if (!posterRes.ok) {
            const errData = await posterRes.json().catch(() => ({}));
            throw new Error((errData as { error?: string }).error ?? "Подію створено, але не вдалося завантажити постер");
          }
        }
        router.push("/admin/events");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg" style={{ width: "100%", minWidth: 0 }}>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Title order={2}>{isEdit ? "Редагувати подію" : "Нова подія"}</Title>
        <Button component={Link} href="/admin/events" variant="subtle" size="xs">
          ← До списку
        </Button>
      </Group>
      {error && <Text c="red" size="sm">{error}</Text>}
      <Card withBorder p="lg" radius="md">
        <Stack gap="md">
          {!isEdit && (
            <>
              {orgs.length === 0 ? (
                <Text size="sm" c="dimmed" py="sm">
                  Спочатку створіть організацію. Перейдіть на головну адмін-панелі та додайте організацію.
                </Text>
              ) : (
                <Select
                  label="Організація"
                  data={orgs.map((o) => ({ value: o.id, label: o.name }))}
                  value={orgId}
                  onChange={(v) => setOrgId(v ?? "")}
                  required
                />
              )}
              {orgs.length > 0 && (
                <Select
                  label="Банка для оплати (Monobank)"
                  placeholder={jarsLoading ? "Завантаження…" : jars.length === 0 ? "Спочатку підключіть Monobank для організації в адмін-панелі" : "Оберіть банку"}
                  data={jars.map((j) => ({ value: j.id, label: j.title }))}
                  value={jarId ?? ""}
                  onChange={(v) => setJarId(v ?? null)}
                  required
                  disabled={jarsLoading || jars.length === 0}
                  description="Оплати за квитки надходитимуть на обрану банку"
                />
              )}
            </>
          )}
          <TextInput label="Назва події" value={title} onChange={(e) => setTitle(e.currentTarget.value)} placeholder="Концерт" required />
          <Group grow wrap="wrap" style={{ alignItems: "flex-end" }}>
            <TextInput type="date" label="Дата концерту" value={date} onChange={(e) => setDate(e.currentTarget.value)} required style={{ minWidth: 0, flex: "1 1 140px" }} />
            <TextInput type="time" label="Час початку (Київ)" value={time} onChange={(e) => setTime(e.currentTarget.value)} required style={{ minWidth: 0, flex: "1 1 100px" }} />
          </Group>
          <Text size="xs" c="dimmed">Час вказується за київським часом</Text>
          <TextInput label="Місто" value={city} onChange={(e) => setCity(e.currentTarget.value)} placeholder="Київ" required />
          <TextInput label="Майданчик" value={venue} onChange={(e) => setVenue(e.currentTarget.value)} placeholder="Назва залу" required />
          <Textarea label="Опис події" value={description} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="Короткий опис події для відображення на сторінці" minRows={8} autosize maxRows={20} style={{ minWidth: "100%" }} required />
          <Box>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Види квитків</Text>
              <Button size="xs" variant="light" onClick={addTicketRow}>
                + Додати вид квитка
              </Button>
            </Group>
            <Stack gap="xs">
              {ticketRows.map((row, i) => (
                <Group key={i} gap="xs" wrap="wrap" align="flex-end">
                  <TextInput
                    placeholder="напр. VIP, Платинум"
                    value={row.name}
                    onChange={(e) => updateTicketRow(i, "name", e.currentTarget.value)}
                    style={{ flex: "1 1 120px", minWidth: 0 }}
                  />
                  <TextInput
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="ціна грн"
                    value={row.priceCents}
                    onChange={(e) => updateTicketRow(i, "priceCents", e.currentTarget.value)}
                    style={{ width: 100, flexShrink: 0 }}
                  />
                  <Button size="xs" variant="subtle" color="red" onClick={() => removeTicketRow(i)} aria-label="Видалити">
                    ×
                  </Button>
                </Group>
              ))}
            </Stack>
          </Box>
          {!isEdit && (
            <Box>
              <Text size="sm" fw={600} mb="xs">Фото для афіші (постер)</Text>
              <Text size="xs" c="dimmed" mb={4}>JPEG, PNG або WebP, макс. {POSTER_MAX_MB} МБ</Text>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (!f) { setPosterFile(null); return; }
                  if (f.size > POSTER_MAX_BYTES) {
                    setError(`Фото афіші: макс. ${POSTER_MAX_MB} МБ`);
                    setPosterFile(null);
                    ev.target.value = "";
                    return;
                  }
                  setError("");
                  setPosterFile(f);
                }}
              />
              {posterFile && <Text size="xs" c="dimmed" mt="xs">{posterFile.name}</Text>}
            </Box>
          )}
          {isEdit && event && (
            <Box pt="md" style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}>
              <Text size="sm" fw={600} mb="xs">Постер та фото організатора</Text>
              <Group gap="md">
                {event.posterUrl && (
                  <Box style={{ width: 56, height: 72, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={event.posterUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Box>
                )}
                <Box>
                  <Text size="xs" c="dimmed" mb={4}>Постер</Text>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadLoading !== null}
                    onChange={async (ev) => {
                      const f = ev.target.files?.[0];
                      if (!f) return;
                      setUploadLoading("poster");
                      setUploadError(null);
                      const fd = new FormData();
                      fd.append("file", f);
                      try {
                        const r = await fetch(`/api/admin/events/${event.id}/poster`, { method: "POST", body: fd });
                        const data = await r.json().catch(() => ({}));
                        if (r.ok) router.refresh();
                        else setUploadError((data as { error?: string }).error ?? "Не вдалося завантажити постер");
                      } catch {
                        setUploadError("Не вдалося завантажити постер");
                      } finally {
                        setUploadLoading(null);
                        ev.target.value = "";
                      }
                    }}
                  />
                  {uploadLoading === "poster" && <Text size="xs" c="dimmed" mt="xs">Завантаження…</Text>}
                </Box>
                {event.organizerPhotoUrl && (
                  <Box style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={event.organizerPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Box>
                )}
                <Box>
                  <Text size="xs" c="dimmed" mb={4}>Фото організатора</Text>
                  <Text size="xs" c="dimmed" mb={4} style={{ display: "block" }}>Завантажте один раз — відображатиметься на сторінці події</Text>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadLoading !== null}
                    onChange={async (ev) => {
                      const f = ev.target.files?.[0];
                      if (!f) return;
                      setUploadLoading("organizer");
                      setUploadError(null);
                      const fd = new FormData();
                      fd.append("file", f);
                      try {
                        const r = await fetch(`/api/admin/events/${event.id}/organizer-photo`, { method: "POST", body: fd });
                        const data = await r.json().catch(() => ({}));
                        if (r.ok) router.refresh();
                        else setUploadError((data as { error?: string }).error ?? "Не вдалося завантажити фото");
                      } catch {
                        setUploadError("Не вдалося завантажити фото");
                      } finally {
                        setUploadLoading(null);
                        ev.target.value = "";
                      }
                    }}
                  />
                  {uploadLoading === "organizer" && <Text size="xs" c="dimmed" mt="xs">Завантаження…</Text>}
                </Box>
              </Group>
              {uploadError && <Text size="xs" c="red" mt="xs">{uploadError}</Text>}
            </Box>
          )}

          <Group>
            <Button onClick={handleSubmit} loading={loading}>
              {isEdit ? "Зберегти" : "Створити подію"}
            </Button>
            {isEdit && event && (
              <DeleteEventButton eventId={event.id} eventTitle={event.title} redirectAfter="/admin/events" />
            )}
          </Group>
          {isEdit && event && (
            <>
              <IssueTicketsBlock eventId={event.id} />
              <EventTicketiersBlock eventId={event.id} orgId={event.orgId} />
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
