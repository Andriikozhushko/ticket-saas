"use client";

import { useRouter } from "next/navigation";
import { Button, Modal } from "@mantine/core";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";

export default function DeleteEventButton({
  eventId,
  eventTitle,
  redirectAfter,
}: {
  eventId: string;
  eventTitle: string;
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        close();
        if (redirectAfter) router.push(redirectAfter);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="subtle" color="red" size="xs" onClick={open}>
        Видалити
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        title="Видалити подію?"
        centered
      >
        <p style={{ margin: "0 0 16px" }}>
          Подія «{eventTitle}» та всі повʼязані замовлення й квитки будуть видалені безповоротно.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button variant="subtle" onClick={close}>Скасувати</Button>
          <Button color="red" loading={loading} onClick={handleDelete}>Видалити</Button>
        </div>
      </Modal>
    </>
  );
}
