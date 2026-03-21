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
        Р’РёРґР°Р»РёС‚Рё
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        title="Р’РёРґР°Р»РёС‚Рё РїРѕРґС–СЋ?"
        centered
      >
        <p style={{ margin: "0 0 16px" }}>
          РџРѕРґС–я В«{eventTitle}В» С‚Р° РІСЃС– РїРѕРІКјСЏР·Р°РЅС– Р·Р°РјРѕРІР»Рµння Р№ РєРІРёС‚РєРё Р±СѓРґСѓС‚ь РІРёРґР°Р»РµРЅС– Р±РµР·РїРѕРІРѕСЂРѕС‚РЅРѕ.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button variant="subtle" onClick={close}>РЎРєР°СЃСѓРІР°С‚Рё</Button>
          <Button color="red" loading={loading} onClick={handleDelete}>Р’РёРґР°Р»РёС‚Рё</Button>
        </div>
      </Modal>
    </>
  );
}

