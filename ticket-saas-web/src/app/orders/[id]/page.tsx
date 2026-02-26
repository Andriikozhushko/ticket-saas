import { headers } from "next/headers";
import Link from "next/link";
import { Box, Button, Card, Stack, Text, Title } from "@mantine/core";
import RefreshOrderButton from "./refresh-order-button";
import PaymentCountdown from "./payment-countdown";
import CopyAmountButton from "./copy-amount-button";
import OrderStatusPoller from "./order-status-poller";
import OrderErrorState from "./order-error-state";

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
  try {
    const res = await fetch(`${origin}/api/public/orders/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function OrderPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return <OrderErrorState />;
  const origin = `${proto}://${host}`;
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
    statusLabel = "Очікує оплати";
    instruction = "Оплатіть вказану суму кнопкою нижче. Після оплати квиток з’явиться на цій сторінці.";
    statusBg = "rgba(239,68,68,0.12)";
    statusBorder = "rgba(239,68,68,0.35)";
  } else if (isPaid) {
    statusLabel = "Оплачено";
    instruction = "Оплачено. Квиток доступний нижче та в розділі «Мої квитки» після входу.";
    statusBg = "rgba(34,197,94,0.12)";
    statusBorder = "rgba(34,197,94,0.35)";
  } else {
    statusLabel = "Час вийшов";
    instruction = "Час на оплату минув.";
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
            ← На головну
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
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={8} style={{ letterSpacing: "0.05em" }}>Сума до сплати</Text>
              {order.amountHuman != null ? (
                <Box style={{ display: "flex", justifyContent: "center" }}>
                  <CopyAmountButton amountHuman={order.amountHuman} currency="UAH" />
                </Box>
              ) : (
                <Title order={2} style={{ margin: 0, fontWeight: 800, color: "var(--text)" }}>—</Title>
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
                    Оплатити
                  </Button>
                ) : (
                  <Text size="sm" c="dimmed">Посилання на оплату тимчасово недоступне. Звʼяжіться з організатором.</Text>
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
                  Квитки для входу {tickets.length > 1 ? `(${tickets.length} шт.)` : ""}
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
                        <Text size="xs" fw={600} c="dimmed" mb="xs" style={{ color: "#374151" }}>Квиток {i + 1}</Text>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${origin}/api/public/tickets/verify/${ticket.id}`)}&bgcolor=FFFFFF&color=000000`}
                        alt={tickets.length > 1 ? `QR ${i + 1}` : "QR квитка"}
                        width={220}
                        height={220}
                        style={{ display: "block", borderRadius: 10 }}
                      />
                    </Box>
                  ))}
                </Box>
                <Text size="xs" c="dimmed" mt="xs">Покажіть QR на вході на подію</Text>
              </Box>
            );
          })()}
          </Stack>
        </Card>
      </Box>
    </Box>
  );
}
