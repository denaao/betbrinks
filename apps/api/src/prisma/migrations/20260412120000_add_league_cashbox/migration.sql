-- Add cashbox columns to leagues table
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "cashbox" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "cashbox_initial" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "cashbox_min_alert" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "is_open" BOOLEAN NOT NULL DEFAULT true;

-- Create CashboxLogType enum
DO $$ BEGIN
  CREATE TYPE "CashboxLogType" AS ENUM ('DEPOSIT', 'BET_LOST', 'BET_WON', 'PLATFORM_FEE', 'WITHDRAWAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create cashbox_logs table
CREATE TABLE IF NOT EXISTS "cashbox_logs" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "type" "CashboxLogType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "bet_slip_id" INTEGER,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashbox_logs_pkey" PRIMARY KEY ("id")
);

-- Create index
CREATE INDEX IF NOT EXISTS "cashbox_logs_league_id_created_at_idx" ON "cashbox_logs"("league_id", "created_at");

-- Add foreign key
DO $$ BEGIN
  ALTER TABLE "cashbox_logs" ADD CONSTRAINT "cashbox_logs_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
