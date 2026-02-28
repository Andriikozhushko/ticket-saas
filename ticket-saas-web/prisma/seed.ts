import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  console.log("Seed done ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());