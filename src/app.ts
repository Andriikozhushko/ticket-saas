// src/app.ts
import Fastify from "fastify";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import path from "path";
import fastifyStatic from "@fastify/static";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

/** ======================
 *  HELPERS
 ====================== */

function nowPlusMinutes(m: number) {
  return new Date(Date.now() + m * 60 * 1000);
}

function signTicket(ticketId: string, orderId: string, v: number) {
  const secret = process.env.QR_SECRET || "";
  if (!secret) throw new Error("QR_SECRET not set in .env");
  const payload = `${ticketId}.${orderId}.${v}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { payload, sig };
}

function verifyTicketSig(ticketId: string, orderId: string, v: number, sig: string) {
  const { sig: expected } = signTicket(ticketId, orderId, v);

  // одинаковая длина буферов, иначе timingSafeEqual бросит исключение
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

/** ======================
 *  MONO TYPES
 ====================== */

type MonoStatementItem = {
  id: string;
  time: number;
  amount: number; // копейки (может быть + или -)
  currencyCode?: number;
  description?: string;
  comment?: string;
  hold?: boolean;
};

type MonoClientInfo = {
  accounts: Array<{
    id: string;
    currencyCode: number;
    type?: string;
    iban?: string;
    sendId?: string;
  }>;
  jars?: Array<{
    id: string;
    sendId: string; // часто "jar/XXXX"
    title: string;
    description?: string;
    currencyCode: number;
    balance?: number;
    goal?: number;
  }>;
};

/** ======================
 *  DB ACTION: mark paid
 ====================== */

async function tryMarkOrderPaidByMono(
  orderId: string,
  monoOperationId: string,
  amountCents: number,
  occurredAt: Date,
  raw: any
) {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({
      where: { id: orderId },
      include: { ticket: true },
    });

    if (!fresh) return { ok: false as const, reason: "Order not found" as const };
    if (fresh.status !== "awaiting_payment") return { ok: false as const, reason: "Not pending" as const };
    if (fresh.expiresAt < new Date()) return { ok: false as const, reason: "Expired" as const };

    await tx.order.update({
      where: { id: orderId },
      data: { status: "paid" },
    });

    // идемпотентность: monoOperationId UNIQUE
    await tx.payment.create({
      data: {
        monoOperationId,
        amountCents,
        occurredAt,
        rawJson: raw,
        orderId,
      },
    });

    const ticket = await tx.ticket.create({
      data: { orderId, qrSecretVersion: 1 },
    });

    const { payload, sig } = signTicket(ticket.id, orderId, ticket.qrSecretVersion);
    return { ok: true as const, ticketId: ticket.id, qrText: `${payload}.${sig}` };
  });
}

/** ======================
 *  MONO POLLING
 *
 *  ВАЖНО:
 *  Event.monoAccountId = jarId (да, название legacy).
 *  Для statement дергаем /personal/statement/{jarId}/from/to
 ====================== */

async function pollMonoOnce() {
  const pending = await prisma.order.findMany({
    where: {
      status: "awaiting_payment",
      expiresAt: { gt: new Date() },
    },
    include: {
      event: {
        include: {
          org: { include: { mono: true } },
        },
      },
    },
    take: 300,
  });

  const byKey = new Map<string, typeof pending>();

  for (const o of pending) {
    const mono = o.event.org.mono;
    if (!mono) continue;

    const jarId = (o.event as any).monoAccountId || mono.accountId;
    if (!jarId || jarId === "0") continue;

    const key = `${mono.token}::${jarId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(o);
  }

  for (const [key, orders] of byKey.entries()) {
    const [token, jarId] = key.split("::");

    const to = Math.floor(Date.now() / 1000);
    const from = to - 2 * 60 * 60;

    const url = `https://api.monobank.ua/personal/statement/${jarId}/${from}/${to}`;
    const res = await fetch(url, { headers: { "X-Token": token } });

    if (!res.ok) {
      app.log.warn({ jarId, status: res.status }, "Mono statement failed");
      continue;
    }

    const items = (await res.json()) as MonoStatementItem[];

    // index по ABS(amount)
    const map = new Map<number, MonoStatementItem[]>();
    for (const it of items) {
      if (it.hold === true) continue; // hold не считаем оплатой
      const amt = Math.abs(it.amount);
      if (!map.has(amt)) map.set(amt, []);
      map.get(amt)!.push(it);
    }

    for (const order of orders) {
      const candidates = map.get(order.amountExpectedCents);
      if (!candidates?.length) continue;

      const createdTs = order.createdAt.getTime();
      const notBefore = createdTs - 2 * 60 * 1000;
      const notAfter = order.expiresAt.getTime() + 10 * 60 * 1000;

      const filtered = candidates.filter((it) => {
        const t = it.time * 1000;
        return t >= notBefore && t <= notAfter;
      });
      if (!filtered.length) continue;

      filtered.sort(
        (a, b) => Math.abs(a.time * 1000 - createdTs) - Math.abs(b.time * 1000 - createdTs)
      );

      const it = filtered[0];

      try {
        const applied = await tryMarkOrderPaidByMono(
          order.id,
          it.id,
          Math.abs(it.amount),
          new Date(it.time * 1000),
          it
        );

        if (applied.ok) {
          app.log.info({ orderId: order.id, monoOp: it.id }, "Paid by mono polling");
        }
      } catch (e) {
        app.log.warn(e, "apply payment failed (maybe duplicate)");
      }
    }
  }
}

/** ======================
 *  STATIC UI
 ====================== */

app.register(fastifyStatic, {
  root: path.join(process.cwd(), "public"),
});

app.get("/ui", async (_, reply) => reply.sendFile("index.html"));

/** ======================
 *  DEV PAY (fake)
 ====================== */

app.post("/dev/pay", async (req, reply) => {
  const body = req.body as { orderId: string };
  if (!body?.orderId) return reply.code(400).send({ error: "orderId required" });

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { ticket: true },
  });

  if (!order) return reply.code(404).send({ error: "Order not found" });
  if (order.status === "paid" && order.ticket) return { ok: true, alreadyPaid: true, ticketId: order.ticket.id };
  if (order.expiresAt < new Date()) return reply.code(409).send({ error: "Order expired" });

  const result = await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: "paid" } });

    await tx.payment.create({
      data: {
        monoOperationId: `dev-${order.id}`,
        amountCents: order.amountExpectedCents,
        occurredAt: new Date(),
        rawJson: { dev: true, orderId: order.id },
        orderId: order.id,
      },
    });

    const ticket = await tx.ticket.create({
      data: { orderId: order.id, qrSecretVersion: 1 },
    });

    return { ticket };
  });

  const { payload, sig } = signTicket(result.ticket.id, order.id, result.ticket.qrSecretVersion);

  return { ok: true, orderId: order.id, ticketId: result.ticket.id, qrText: `${payload}.${sig}` };
});


// DEV: mark paid (no mono)
app.post("/dev/mark-paid", async (req, reply) => {
  const body = req.body as { orderId: string };
  if (!body?.orderId) return reply.code(400).send({ error: "orderId required" });

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { payment: true, ticket: true },
  });
  if (!order) return reply.code(404).send({ error: "Order not found" });

  // If already paid -> just return qr
  if (order.status === "paid" && order.ticket) {
    const { payload, sig } = signTicket(order.ticket.id, order.id, order.ticket.qrSecretVersion);
    return { ok: true, alreadyPaid: true, orderId: order.id, ticketId: order.ticket.id, qrText: `${payload}.${sig}` };
  }

  if (order.expiresAt < new Date()) return reply.code(409).send({ error: "Order expired" });

  const result = await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: "paid" } });

    // create payment if none
    await tx.payment.create({
      data: {
        monoOperationId: `dev-${order.id}-${Date.now()}`,
        amountCents: order.amountExpectedCents,
        occurredAt: new Date(),
        rawJson: { dev: true, orderId: order.id },
        orderId: order.id,
      },
    });

    const ticket = await tx.ticket.create({
      data: { orderId: order.id, qrSecretVersion: 1 },
    });

    return { ticket };
  });

  const { payload, sig } = signTicket(result.ticket.id, order.id, result.ticket.qrSecretVersion);

  return { ok: true, orderId: order.id, ticketId: result.ticket.id, qrText: `${payload}.${sig}` };
});

// DEV: reset order back to awaiting_payment (so you can reuse same flow)
app.post("/dev/reset-order", async (req, reply) => {
  const body = req.body as { orderId: string };
  if (!body?.orderId) return reply.code(400).send({ error: "orderId required" });

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { payment: true, ticket: true },
  });
  if (!order) return reply.code(404).send({ error: "Order not found" });

  await prisma.$transaction(async (tx) => {
    // delete ticket first (FK)
    if (order.ticket) {
      await tx.ticket.delete({ where: { id: order.ticket.id } });
    }

    // delete payment linked to order (orderId unique)
    if (order.payment) {
      await tx.payment.delete({ where: { id: order.payment.id } });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "awaiting_payment",
        // продлеваем жизнь, чтобы не истекал
        expiresAt: nowPlusMinutes(20),
      },
    });
  });

  return { ok: true, orderId: order.id, status: "awaiting_payment" };
});
/** ======================
 *  SCAN
 ====================== */

app.post("/scan", async (req, reply) => {
  const token = req.headers["x-scanner-token"];
  if (token !== process.env.SCANNER_TOKEN) {
    return reply.code(401).send({ error: "Unauthorized scanner" });
  }

  const body = req.body as { qrText: string; usedBy?: string };
  if (!body?.qrText) return reply.code(400).send({ error: "qrText required" });

  const parts = body.qrText.split(".");
  if (parts.length < 4) return reply.code(400).send({ error: "Bad QR format" });

  const ticketId = parts[0];
  const orderId = parts[1];
  const v = Number(parts[2]);
  const sig = parts.slice(3).join(".");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { order: true },
  });

  if (!ticket) return reply.code(404).send({ error: "Ticket not found" });
  if (ticket.orderId !== orderId) return reply.code(400).send({ error: "Order mismatch" });

  const ok = verifyTicketSig(ticketId, orderId, ticket.qrSecretVersion, sig);
  if (!ok) return reply.code(401).send({ error: "Bad signature" });

  if (ticket.usedAt) {
    return reply.code(409).send({
      error: "Already used",
      usedAt: ticket.usedAt,
      usedBy: ticket.usedBy,
    });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      usedAt: new Date(),
      usedBy: body.usedBy || "dev-scanner",
    },
  });

  return { ok: true, ticketId: updated.id, usedAt: updated.usedAt, usedBy: updated.usedBy };
});

/** ======================
 *  HEALTH + ORDERS
 ====================== */

app.get("/", async () => ({ status: "ok" }));

app.get("/health/db", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { db: "ok" };
});

app.get("/orders/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payment: true, ticket: true, event: true },
  });

  if (!order) return reply.code(404).send({ error: "Order not found" });

  return {
    id: order.id,
    status: order.status,
    amountExpectedCents: order.amountExpectedCents,
    amountHuman: (order.amountExpectedCents / 100).toFixed(2),
    expiresAt: order.expiresAt,
    isExpired: order.expiresAt < new Date(),
    hasPayment: !!order.payment,
    hasTicket: !!order.ticket,
    ticket: order.ticket
      ? { id: order.ticket.id, usedAt: order.ticket.usedAt, usedBy: order.ticket.usedBy }
      : null,
  };
});

// ✅ НОВОЕ: выдача QR по orderId (после оплаты)
app.get("/orders/:id/qr", async (req, reply) => {
  const { id } = req.params as { id: string };

  const order = await prisma.order.findUnique({
    where: { id },
    include: { ticket: true },
  });

  if (!order) return reply.code(404).send({ error: "Order not found" });
  if (order.status !== "paid" || !order.ticket) {
    return reply.code(409).send({ error: "Order not paid or ticket not created yet" });
  }

  const { payload, sig } = signTicket(order.ticket.id, order.id, order.ticket.qrSecretVersion);
  return { ok: true, ticketId: order.ticket.id, qrText: `${payload}.${sig}` };
});

/** ======================
 *  MONO CONNECT + LINK JAR
 ====================== */

app.post("/mono/connect", async (req, reply) => {
  const body = req.body as { orgId: string; token: string };
  if (!body?.orgId || !body?.token) return reply.code(400).send({ error: "orgId and token required" });

  const res = await fetch("https://api.monobank.ua/personal/client-info", {
    headers: { "X-Token": body.token },
  });

  if (!res.ok) {
    const text = await res.text();
    return reply.code(400).send({ error: "Monobank auth failed", details: text });
  }

  const info = (await res.json()) as MonoClientInfo;

  const jars = (info.jars || [])
    .filter((j) => j.currencyCode === 980 && !!j.sendId)
    .map((j) => ({
      id: j.id, // jarId
      // нормализуем до "XXXX" (без "jar/")
      sendId: j.sendId.startsWith("jar/") ? j.sendId.slice(4) : j.sendId,
      title: j.title,
      currencyCode: j.currencyCode,
    }));

  const defaultJarId = jars[0]?.id || "0";

  const conn = await prisma.monoConnection.upsert({
    where: { orgId: body.orgId },
    update: { token: body.token, accountId: defaultJarId },
    create: { orgId: body.orgId, token: body.token, accountId: defaultJarId },
  });

  return {
    ok: true,
    orgId: conn.orgId,
    defaultJarId: conn.accountId !== "0" ? conn.accountId : null,
    jars,
  };
});

// ✅ ВАЖНО: UI должен дергать ЭТОТ endpoint
app.post("/events/set-mono-jar", async (req, reply) => {
  const body = req.body as { eventId: string; jarId: string };

  if (!body?.eventId || !body?.jarId) {
    return reply.code(400).send({ error: "eventId and jarId required" });
  }

  const ev = await prisma.event.update({
    where: { id: body.eventId },
    data: { monoAccountId: body.jarId as any },
  });

  return { ok: true, eventId: ev.id, monoAccountId: (ev as any).monoAccountId };
});

/** ======================
 *  DEV: FORCE CHECK NOW
 ====================== */

app.post("/dev/check-order-mono", async (req, reply) => {
  const body = req.body as { orderId: string };
  if (!body?.orderId) return reply.code(400).send({ error: "orderId required" });

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: { event: true, ticket: true, payment: true },
  });
  if (!order) return reply.code(404).send({ error: "Order not found" });
  if (order.status === "paid") return { ok: true, alreadyPaid: true };

  const jarId = (order.event as any).monoAccountId;
  if (!jarId) return reply.code(400).send({ error: "Event has no monoAccountId (link jar to event first)" });

  const org = await prisma.organization.findUnique({
    where: { id: order.event.orgId },
    include: { mono: true },
  });
  if (!org?.mono) return reply.code(400).send({ error: "Org has no mono connection" });

  const to = Math.floor(Date.now() / 1000);
  const from = to - 2 * 60 * 60;

  const url = `https://api.monobank.ua/personal/statement/${jarId}/${from}/${to}`;
  const res = await fetch(url, { headers: { "X-Token": org.mono.token } });
  if (!res.ok) return reply.code(400).send({ error: "statement failed", status: res.status });

  const items = (await res.json()) as MonoStatementItem[];

  const hit = items.find((i) => i.hold === false && Math.abs(i.amount) === order.amountExpectedCents);

  if (!hit) return { ok: true, found: false, hint: "No matching amount in last 2h" };

  const applied = await tryMarkOrderPaidByMono(
    order.id,
    hit.id,
    Math.abs(hit.amount),
    new Date(hit.time * 1000),
    hit
  );

  return { ok: true, found: true, applied };
});

/** ======================
 *  TEST USER (dev)
 ====================== */

app.post("/test-user", async () => {
  const user = await prisma.user.create({
    data: {
      email: `test${Date.now()}@mail.com`,
      passwordHash: "123",
    },
  });
  return user;
});

/** ======================
 *  ORG
 ====================== */

app.post("/orgs/create-by-email", async (req, reply) => {
  const body = req.body as { ownerEmail: string; name: string };
  if (!body?.ownerEmail || !body?.name) return reply.code(400).send({ error: "ownerEmail and name required" });

  const user = await prisma.user.findUnique({ where: { email: body.ownerEmail } });
  if (!user) return reply.code(404).send({ error: "Owner user not found" });

  const org = await prisma.organization.create({
    data: { ownerId: user.id, name: body.name },
  });

  return org;
});

/** ======================
 *  EVENT
 ====================== */

app.post("/events/create", async (req, reply) => {
  const body = req.body as { orgId: string; title: string; priceCents: number };
  if (!body?.orgId || !body?.title || typeof body.priceCents !== "number") {
    return reply.code(400).send({ error: "orgId, title, priceCents required" });
  }

  const event = await prisma.event.create({
    data: {
      orgId: body.orgId,
      title: body.title,
      priceCents: body.priceCents,
      currency: "UAH",
    },
  });

  return event;
});

/** ======================
 *  ORDER (unique cents)
 ====================== */

app.post("/orders/create", async (req, reply) => {
  const body = req.body as { eventId: string; buyerEmail: string };
  if (!body?.eventId || !body?.buyerEmail) {
    return reply.code(400).send({ error: "eventId and buyerEmail required" });
  }

  const event = await prisma.event.findUnique({ where: { id: body.eventId } });
  if (!event) return reply.code(404).send({ error: "Event not found" });

  const expiresAt = nowPlusMinutes(20);

  for (let k = 1; k <= 9999; k++) {
    const amountExpectedCents = event.priceCents + k;

    try {
      const order = await prisma.order.create({
        data: {
          eventId: event.id,
          buyerEmail: body.buyerEmail,
          amountExpectedCents,
          status: "awaiting_payment",
          expiresAt,
        },
      });

      return {
        orderId: order.id,
        amountExpectedCents,
        amountHuman: (amountExpectedCents / 100).toFixed(2),
        expiresAt,
      };
    } catch {
      continue;
    }
  }

  return reply.code(409).send({ error: "No free amounts available" });
});

/** ======================
 *  SERVER START + JOBS
 ====================== */

const start = async () => {
  try {
    const address = await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log(`Server running at ${address} (open /ui)`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();

// expire job
setInterval(async () => {
  try {
    const res = await prisma.order.updateMany({
      where: { status: "awaiting_payment", expiresAt: { lt: new Date() } },
      data: { status: "expired" },
    });
    if (res.count > 0) app.log.info({ expired: res.count }, "Expired orders cleaned");
  } catch (e) {
    app.log.error(e, "Expire job failed");
  }
}, 30_000);

// mono polling job
setInterval(() => {
  pollMonoOnce().catch((e) => app.log.error(e, "pollMonoOnce failed"));
}, 60_000);