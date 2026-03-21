import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/brevo";
import { buildQrImageUrl } from "@/lib/qr";

export type TicketEmailReason =
  | "payment_confirmed"
  | "gift"
  | "issuance"
  | "purchase";

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? "https://lizard.red").replace(/\/$/, "");
}

function buildEmailCopy(reason: TicketEmailReason, eventTitle: string, myTicketsUrl: string) {
  switch (reason) {
    case "gift":
      return {
        subject: `Вам подарували квиток на подію «${eventTitle}»`,
        htmlIntro: `Вам подарували квиток(и) на подію <strong>${eventTitle}</strong>.`,
        text: `Вам подарували квиток(и) на подію «${eventTitle}». Переглянути: ${myTicketsUrl}`,
      };
    case "issuance":
      return {
        subject: `Вам видано квиток на подію «${eventTitle}»`,
        htmlIntro: `Вам видано квиток(и) на подію <strong>${eventTitle}</strong>.`,
        text: `Вам видано квиток(и) на подію «${eventTitle}». Переглянути: ${myTicketsUrl}`,
      };
    case "purchase":
      return {
        subject: `Ваші квитки на подію «${eventTitle}»`,
        htmlIntro: `Ваші квитки на подію <strong>${eventTitle}</strong> готові.`,
        text: `Ваші квитки на подію «${eventTitle}» готові. Переглянути: ${myTicketsUrl}`,
      };
    default:
      return {
        subject: `Ваш квиток — ${eventTitle}`,
        htmlIntro: `Оплату отримано. Ваш квиток на подію <strong>${eventTitle}</strong> готовий.`,
        text: `Оплату отримано. Квиток(и) на подію «${eventTitle}» готові. Переглянути: ${myTicketsUrl}`,
      };
  }
}

export async function sendTicketsEmail(orderId: string, reason: TicketEmailReason): Promise<void> {
  const baseUrl = getBaseUrl();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { event: { select: { title: true } }, tickets: true },
  });
  if (!order?.tickets.length) {
    return;
  }

  const eventTitle = order.event?.title ?? "Подія";
  const myTicketsUrl = `${baseUrl}/my-tickets`;
  const qrSize = 240;
  const qrImages = order.tickets
    .map((ticket) => {
      const verifyUrl = `${baseUrl}/api/public/tickets/verify/${ticket.id}`;
      const qrUrl = buildQrImageUrl(baseUrl, verifyUrl, qrSize, "png");
      return `<div style="margin:16px 0;">
        <img
          src="${qrUrl}"
          alt="QR-код квитка"
          width="${qrSize}"
          height="${qrSize}"
          style="display:block;width:${qrSize}px;height:${qrSize}px;border-radius:12px;background:#ffffff;padding:8px;"
        />
      </div>`;
    })
    .join("");

  const copy = buildEmailCopy(reason, eventTitle, myTicketsUrl);
  const htmlContent = `
    <p>${copy.htmlIntro}</p>
    <p>QR-коди для входу:</p>
    ${qrImages}
    <p><a href="${myTicketsUrl}">Переглянути мої квитки</a> (увійдіть з email ${order.buyerEmail}).</p>
  `;

  await sendEmail({
    to: order.buyerEmail,
    subject: copy.subject,
    textContent: copy.text,
    htmlContent,
  });
}
