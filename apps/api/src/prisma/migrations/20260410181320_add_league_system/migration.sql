/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeagueMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "LeagueMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "bet_slips" ADD COLUMN     "league_id" INTEGER;

-- AlterTable
ALTER TABLE "league_members" ADD COLUMN     "role" "LeagueMemberRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "status" "LeagueMemberStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN     "is_official" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "owner_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" VARCHAR(14),
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "league_balances" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_join_requests" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "league_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_transactions" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "from_user_id" INTEGER,
    "to_user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_balances_league_id_user_id_key" ON "league_balances"("league_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_join_requests_league_id_user_id_key" ON "league_join_requests"("league_id", "user_id");

-- CreateIndex
CREATE INDEX "league_transactions_league_id_created_at_idx" ON "league_transactions"("league_id", "created_at");

-- CreateIndex
CREATE INDEX "league_transactions_to_user_id_league_id_idx" ON "league_transactions"("to_user_id", "league_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- AddForeignKey
ALTER TABLE "bet_slips" ADD CONSTRAINT "bet_slips_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_balances" ADD CONSTRAINT "league_balances_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_balances" ADD CONSTRAINT "league_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_join_requests" ADD CONSTRAINT "league_join_requests_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_join_requests" ADD CONSTRAINT "league_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_transactions" ADD CONSTRAINT "league_transactions_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_transactions" ADD CONSTRAINT "league_transactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_transactions" ADD CONSTRAINT "league_transactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
