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
        subject: `Р’Р°Рј РїРѕРґР°СЂСѓРІР°Р»Рё РєРІРёС‚РѕРє РЅР° РїРѕРґС–СЋ В«${eventTitle}В»`,
        htmlIntro: `Р’Р°Рј РїРѕРґР°СЂСѓРІР°Р»Рё РєРІРёС‚РѕРє(Рё) РЅР° РїРѕРґС–СЋ <strong>${eventTitle}</strong>.`,
        text: `Р’Р°Рј РїРѕРґР°СЂСѓРІР°Р»Рё РєРІРёС‚РѕРє(Рё) РЅР° РїРѕРґС–СЋ В«${eventTitle}В». РџРµСЂРµРіР»СЏРЅСѓС‚Рё: ${myTicketsUrl}`,
      };
    case "issuance":
      return {
        subject: `Р’Р°Рј РІРёРґР°РЅРѕ РєРІРёС‚РѕРє РЅР° РїРѕРґС–СЋ В«${eventTitle}В»`,
        htmlIntro: `Р’Р°Рј РІРёРґР°РЅРѕ РєРІРёС‚РѕРє(Рё) РЅР° РїРѕРґС–СЋ <strong>${eventTitle}</strong>.`,
        text: `Р’Р°Рј РІРёРґР°РЅРѕ РєРІРёС‚РѕРє(Рё) РЅР° РїРѕРґС–СЋ В«${eventTitle}В». РџРµСЂРµРіР»СЏРЅСѓС‚Рё: ${myTicketsUrl}`,
      };
    case "purchase":
      return {
        subject: `Р’Р°С€С– РєРІРёС‚РєРё РЅР° РїРѕРґС–СЋ В«${eventTitle}В»`,
        htmlIntro: `Р’Р°С€С– РєРІРёС‚РєРё РЅР° РїРѕРґС–СЋ <strong>${eventTitle}</strong> РіРѕС‚РѕРІС–.`,
        text: `Р’Р°С€С– РєРІРёС‚РєРё РЅР° РїРѕРґС–СЋ В«${eventTitle}В» РіРѕС‚РѕРІС–. РџРµСЂРµРіР»СЏРЅСѓС‚Рё: ${myTicketsUrl}`,
      };
    default:
      return {
        subject: `Р’Р°С€ РєРІРёС‚РѕРє вЂ” ${eventTitle}`,
        htmlIntro: `РћРїР»Р°С‚Сѓ РѕС‚СЂРёРјР°РЅРѕ. Р’Р°С€ РєРІРёС‚РѕРє РЅР° РїРѕРґС–СЋ <strong>${eventTitle}</strong> РіРѕС‚РѕРІРёР№.`,
        text: `РћРїР»Р°С‚Сѓ РѕС‚СЂРёРјР°РЅРѕ. РљРІРёС‚РѕРє(Рё) РЅР° РїРѕРґС–СЋ В«${eventTitle}В» РіРѕС‚РѕРІС–. РџРµСЂРµРіР»СЏРЅСѓС‚Рё: ${myTicketsUrl}`,
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

  const eventTitle = order.event?.title ?? "РџРѕРґС–я";
  const myTicketsUrl = `${baseUrl}/my-tickets`;
  const qrSize = 240;
  const qrImages = order.tickets
    .map((ticket) => {
      const verifyUrl = `${baseUrl}/api/public/tickets/verify/${ticket.id}`;
      const qrUrl = buildQrImageUrl(baseUrl, verifyUrl, qrSize, "png");
      return `<div style="margin:16px 0;">
        <img
          src="${qrUrl}"
          alt="QR-РєРѕРґ РєРІРёС‚РєР°"
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
    <p>QR-РєРѕРґРё РґР»я РІС…оду:</p>
    ${qrImages}
    <p><a href="${myTicketsUrl}">РџРµСЂРµРіР»СЏРЅСѓС‚Рё РјРѕС— РєРІРёС‚РєРё</a> (СѓРІС–Р№РґС–С‚ь Р· email ${order.buyerEmail}).</p>
  `;

  await sendEmail({
    to: order.buyerEmail,
    subject: copy.subject,
    textContent: copy.text,
    htmlContent,
  });
}

