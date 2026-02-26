-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "city" TEXT,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "venue" TEXT;
