import Link from "next/link";
import { headers } from "next/headers";
import { Box, Button, Card, Stack, Text, Title } from "@mantine/core";
import RefreshOrderButton from "./refresh-order-button";
import PaymentCountdown from "./payment-countdown";
import CopyAmountButton from "./copy-amount-button";
import OrderStatusPoller from "./order-status-poller";
import OrderErrorState from "./order-error-state";
import { buildQrImageUrl } from "@/lib/qr";
import { refreshOrderPaymentSnapshot } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Order = {
  id: string;
  status: string;
  amountExpectedCents?: number;
  amountHuman?: string;
  expiresAt?: string;
  isExpired?: boolean;
  hasPayment?: boolean;
  hasTicket?: boolean;
  jarPaymentUrl?: string | null;
  tickets?: { id: string }[];
};

async function getOrder(id: string, origin: string): Promise<Order | null> {
  void origin;
  const result = await refreshOrderPaymentSnapshot(id, true);
  if (!result) return null;
  return result.snapshot as Order;
}

export default async function OrderPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const headerOrigin = host ? `${proto}://${host}` : "";
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? headerOrigin).replace(/\/$/, "");
  const order = await getOrder(id, origin);

  if (!order) return <OrderErrorState />;

  const status = order.status;
  const isPaid = status === "paid" || order.hasTicket;
  const isExpired = status === "expired" || order.isExpired === true;
  const isAwaiting = status === "awaiting_payment" && !isPaid && !isExpired;

  let statusLabel: string;
  let instruction: string;
  let statusBg: string;
  let statusBorder: string;
  if (isAwaiting) {
    statusLabel = "РћС‡С–РєСѓС” РѕРїР»Р°С‚Рё";
    instruction = "РћРїР»Р°С‚С–С‚ь РІРєР°Р·Р°ну суму кнопкою РЅРёР¶С‡Рµ. РџС–СЃР»я РѕРїР»Р°С‚Рё РєРІРёС‚РѕРє Р·вЂ™СЏРІРёС‚ься РЅР° С†С–Р№ СЃС‚РѕСЂС–РЅС†С–.";
    statusBg = "rgba(239,68,68,0.12)";
    statusBorder = "rgba(239,68,68,0.35)";
  } else if (isPaid) {
    statusLabel = "РћРїР»Р°С‡РµРЅРѕ";
    instruction = "РћРїР»Р°С‡РµРЅРѕ. РљРІРёС‚РѕРє РґРѕСЃС‚СѓРїРЅРёР№ РЅРёР¶С‡Рµ С‚Р° РІ СЂРѕР·РґС–Р»С– В«РњРѕС— РєРІРёС‚РєРёВ» РїС–СЃР»я РІС…оду.";
    statusBg = "rgba(34,197,94,0.12)";
    statusBorder = "rgba(34,197,94,0.35)";
  } else {
    statusLabel = "Р§Р°СЃ РІРёР№С€РѕРІ";
    instruction = "Р§Р°СЃ РЅР° РѕРїР»Р°С‚Сѓ минув.";
    statusBg = "rgba(239,68,68,0.12)";
    statusBorder = "rgba(239,68,68,0.35)";
  }

  return (
    <Box style={{ minHeight: "100vh" }}>
      <OrderStatusPoller orderId={id} isAwaiting={isAwaiting} />
      <Box
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "32px 24px 48px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Box style={{ alignSelf: "flex-start", marginBottom: 24 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            в†ђ РќР° РіРѕР»овну
          </Link>
        </Box>

        <Card
          withBorder
          padding="xl"
          radius="lg"
          style={{
            width: "100%",
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(18,8,8,0.72)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          <Stack gap="lg">
            <Box style={{ textAlign: "center" }}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={8} style={{ letterSpacing: "0.05em" }}>РЎСѓРјР° РґРѕ СЃРїР»Р°С‚Рё</Text>
              {order.amountHuman != null ? (
                <Box style={{ display: "flex", justifyContent: "center" }}>
                  <CopyAmountButton amountHuman={order.amountHuman} currency="UAH" />
                </Box>
              ) : (
                <Title order={2} style={{ margin: 0, fontWeight: 800, color: "var(--text)" }}>вЂ”</Title>
              )}
            </Box>

            <Box
              style={{
                padding: "14px 18px",
                borderRadius: 12,
                background: statusBg,
                border: `1px solid ${statusBorder}`,
                textAlign: "center",
              }}
            >
              <Text size="sm" fw={700} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
                {statusLabel}
              </Text>
            </Box>

            {isAwaiting && order.expiresAt && (
              <PaymentCountdown expiresAtIso={order.expiresAt} />
            )}

            <Text size="sm" c="dimmed" style={{ textAlign: "center" }}>{instruction}</Text>

            {isAwaiting && (
              <Stack gap="md" align="center">
                {order.jarPaymentUrl ? (
                  <Button
                    component="a"
                    href={order.jarPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg"
                    radius="md"
                    className="btn-glow"
                    style={{
                      background: "var(--gradient-accent)",
                      border: "none",
                      color: "#030304",
                      fontWeight: 800,
                      boxShadow: "var(--shadow-glow), 0 4px 24px rgba(239,68,68,0.35)",
                    }}
                  >
                    РћРїР»Р°С‚РёС‚Рё
                  </Button>
                ) : (
                  <Text size="sm" c="dimmed">РџРѕСЃРёР»Р°ння РЅР° РѕРїР»Р°С‚Сѓ С‚РёРјС‡Р°сово РЅРµРґРѕСЃС‚СѓРїРЅРµ. Р—РІКјСЏР¶С–С‚ься Р· РѕСЂРіР°РЅС–Р·Р°С‚ором.</Text>
                )}
                <RefreshOrderButton orderId={id} />
              </Stack>
            )}

          {isPaid && (() => {
            const tickets = order.tickets ?? [];
            if (tickets.length === 0) return null;
            return (
              <Box pt="md" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", width: "100%", textAlign: "center" }}>
                <Text size="xs" fw={600} c="dimmed" mb="md" style={{ letterSpacing: "0.05em" }}>
                  РљРІРёС‚РєРё РґР»я РІС…оду {tickets.length > 1 ? `(${tickets.length} С€С‚.)` : ""}
                </Text>
                <Box style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
                  {tickets.map((ticket, i) => (
                    <Box
                      key={ticket.id}
                      style={{
                        padding: 16,
                        background: "#fff",
                        borderRadius: 16,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      {tickets.length > 1 && (
                        <Text size="xs" fw={600} c="dimmed" mb="xs" style={{ color: "#374151" }}>РљРІРёС‚РѕРє {i + 1}</Text>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={buildQrImageUrl(origin, `${origin}/api/public/tickets/verify/${ticket.id}`, 220)}
                        alt={tickets.length > 1 ? `QR ${i + 1}` : "QR РєРІРёС‚РєР°"}
                        width={220}
                        height={220}
                        style={{ display: "block", borderRadius: 10 }}
                      />
                    </Box>
                  ))}
                </Box>
                <Text size="xs" c="dimmed" mt="xs">РџРѕРєР°Р¶С–С‚ь QR РЅР° РІС…РѕРґС– РЅР° РїРѕРґС–СЋ</Text>
              </Box>
            );
          })()}
          </Stack>
        </Card>
      </Box>
    </Box>
  );
}

