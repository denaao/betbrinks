-- AlterTable: add stars system to leagues
ALTER TABLE "leagues" ADD COLUMN "stars" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "leagues" ADD COLUMN "stars_expires_at" TIMESTAMP(3);

-- AlterEnum: add MANAGER role
ALTER TYPE "LeagueMemberRole" ADD VALUE 'MANAGER';
