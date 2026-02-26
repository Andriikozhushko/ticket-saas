-- CreateTable
CREATE TABLE "Ticketier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticketier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketierEvent" (
    "ticketierId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "TicketierEvent_pkey" PRIMARY KEY ("ticketierId","eventId")
);

-- CreateTable
CREATE TABLE "TicketierSession" (
    "id" TEXT NOT NULL,
    "ticketierId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketierSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticketier_login_key" ON "Ticketier"("login");

-- CreateIndex
CREATE INDEX "TicketierEvent_eventId_idx" ON "TicketierEvent"("eventId");

-- CreateIndex
CREATE INDEX "TicketierSession_ticketierId_idx" ON "TicketierSession"("ticketierId");

-- AddForeignKey
ALTER TABLE "Ticketier" ADD CONSTRAINT "Ticketier_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketierEvent" ADD CONSTRAINT "TicketierEvent_ticketierId_fkey" FOREIGN KEY ("ticketierId") REFERENCES "Ticketier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketierEvent" ADD CONSTRAINT "TicketierEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketierSession" ADD CONSTRAINT "TicketierSession_ticketierId_fkey" FOREIGN KEY ("ticketierId") REFERENCES "Ticketier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
