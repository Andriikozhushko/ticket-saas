"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";

export type UserRow = { id: string; email: string; role: string; createdAt: string };

export default function AdminUsersClient({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("user");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const addUser = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) {
      setAddError("Вкажіть email");
      return;
    }
    setAddError(null);
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: addRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddEmail("");
        setAddRole("user");
        router.refresh();
      } else {
        setAddError((data as { error?: string }).error ?? "Не вдалося додати");
      }
    } catch {
      setAddError("Помилка мережі");
    } finally {
      setAddLoading(false);
    }
  };

  const updateRole = async (userId: string, role: string) => {
    setUpdating(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
      } else {
        setError((data as { error?: string }).error ?? "Не вдалося оновити роль");
      }
    } catch {
      setError("Не вдалося оновити роль");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Box style={{ width: "100%", minWidth: 0 }}>
      <Title order={2} mb="lg">Користувачі</Title>
      {error && <Text size="sm" c="red" mb="sm">{error}</Text>}
      <Card withBorder p="md" radius="md" mb="lg">
        <Text size="sm" fw={600} mb="xs">Додати користувача</Text>
        <Stack gap="xs" className="admin-add-user-form">
          <TextInput
            placeholder="email@example.com"
            value={addEmail}
            onChange={(e) => { setAddEmail(e.currentTarget.value); setAddError(null); }}
            type="email"
          />
          <Select
            data={[
              { value: "user", label: "Користувач" },
              { value: "organizer", label: "Організатор" },
              { value: "admin", label: "Адмін" },
            ]}
            value={addRole}
            onChange={(v) => v && setAddRole(v)}
          />
          {addError && <Text size="xs" c="red">{addError}</Text>}
          <Button size="sm" onClick={addUser} loading={addLoading}>Додати</Button>
        </Stack>
      </Card>
      <Card withBorder p={0} radius="md">
        {users.length === 0 ? (
          <Box p="xl">
            <Text size="sm" c="dimmed">Користувачів поки немає.</Text>
          </Box>
        ) : (
        <Box style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Роль</Table.Th>
              <Table.Th>Дата</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td><Text size="sm">{u.email}</Text></Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    style={{ width: 140 }}
                    data={[
                      { value: "user", label: "Користувач" },
                      { value: "organizer", label: "Організатор" },
                      { value: "admin", label: "Адмін" },
                    ]}
                    value={u.role}
                    onChange={(v) => v && updateRole(u.id, v)}
                    disabled={updating === u.id}
                  />
                </Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{new Date(u.createdAt).toLocaleDateString("uk-UA")}</Text></Table.Td>
                <Table.Td />
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </Box>
        )}
      </Card>
    </Box>
  );
}
