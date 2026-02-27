import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const TICKETIER_PASSWORD_SALT = "ticketier-v1";
const TICKETIER_PASSWORD_ITERATIONS = 100000;
const TICKETIER_PASSWORD_KEYLEN = 64;

function hashTicketierPassword(password: string): string {
  return crypto
    .pbkdf2Sync(password, TICKETIER_PASSWORD_SALT, TICKETIER_PASSWORD_ITERATIONS, TICKETIER_PASSWORD_KEYLEN, "sha256")
    .toString("hex");
}

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "org@demo.com" },
    update: {},
    create: { email: "org@demo.com" },
  });

  const org = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: {
      id: "demo-org",
      name: "Demo Org",
      ownerId: owner.id,
    },
  });

  await prisma.event.createMany({
    data: [
      {
        orgId: org.id,
        title: "Dark Rave Night",
        priceCents: 1000,
        currency: "UAH",
        city: "Kyiv",
        venue: "Secret Place",
        posterUrl:
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1600&q=80",
      },
      {
        orgId: org.id,
        title: "Indie Concert",
        priceCents: 1500,
        currency: "UAH",
        city: "Lviv",
        venue: "Old Hall",
        posterUrl:
          "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
      },
      {
        orgId: org.id,
        title: "Stand-up Night",
        priceCents: 800,
        currency: "UAH",
        city: "Odesa",
        venue: "Black Box",
        posterUrl:
          "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=1600&q=80",
      },
    ],
    skipDuplicates: true,
  });

  // Тестовий білетник з доступом до сканування всіх подій у системі
  try {
    const allEvents = await prisma.event.findMany({ select: { id: true } });
    const prismaExtended = prisma as unknown as {
      ticketier: { upsert: (p: {
        where: { login: string };
        create: { orgId: string; login: string; passwordHash: string; displayName: string; createdById: string };
        update: { passwordHash: string };
      }) => Promise<{ id: string }>;
    }};
    const ticketierRow = await prismaExtended.ticketier.upsert({
      where: { login: "ticketier" },
      create: {
        orgId: org.id,
        login: "ticketier",
        passwordHash: hashTicketierPassword("test1234"),
        displayName: "Тестовий білетник (всі події)",
        createdById: owner.id,
      },
      update: { passwordHash: hashTicketierPassword("test1234") },
    });
    const prismaWithTicketierEvent = prisma as unknown as {
      ticketierEvent: { upsert: (p: {
        where: { ticketierId_eventId: { ticketierId: string; eventId: string } };
        create: { ticketierId: string; eventId: string };
        update: Record<string, never>;
      }) => Promise<unknown>;
    }};
    for (const event of allEvents) {
      await prismaWithTicketierEvent.ticketierEvent.upsert({
        where: { ticketierId_eventId: { ticketierId: ticketierRow.id, eventId: event.id } },
        create: { ticketierId: ticketierRow.id, eventId: event.id },
        update: {},
      });
    }
    console.log("Тестовий білетник (доступ до сканування всіх подій):");
    console.log("  Логін: ticketier");
    console.log("  Пароль: test1234");
    console.log("  Сторінка входу: /ticketier/login");
  } catch (err) {
    console.warn("Ticketier seed skip (run migration first):", err instanceof Error ? err.message : err);
  }

  console.log("Seed done ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());