-- Add sportKey to fixtures
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "sport_key" VARCHAR(30) NOT NULL DEFAULT 'football';
CREATE INDEX IF NOT EXISTS "fixtures_sport_key_start_at_idx" ON "fixtures"("sport_key", "start_at");

-- Add key and apiHost to sports
ALTER TABLE "sports" ADD COLUMN IF NOT EXISTS "key" VARCHAR(30) UNIQUE;
ALTER TABLE "sports" ADD COLUMN IF NOT EXISTS "api_host" VARCHAR(200) NOT NULL DEFAULT '';

-- Update existing sports to set key and api_host
UPDATE "sports" SET "key" = 'football',   "api_host" = 'v3.football.api-sports.io'       WHERE "key" IS NULL AND ("name" ILIKE '%futebol%' OR "name" ILIKE '%football%');
UPDATE "sports" SET "key" = 'basketball', "api_host" = 'v1.basketball.api-sports.io'     WHERE "key" IS NULL AND ("name" ILIKE '%basquete%' OR "name" ILIKE '%basketball%');
UPDATE "sports" SET "key" = 'volleyball', "api_host" = 'v1.volleyball.api-sports.io'     WHERE "key" IS NULL AND ("name" ILIKE '%v_lei%' OR "name" ILIKE '%volleyball%');
UPDATE "sports" SET "key" = 'mma',        "api_host" = 'v1.mma.api-sports.io'            WHERE "key" IS NULL AND ("name" ILIKE '%mma%');
UPDATE "sports" SET "key" = 'formula1',   "api_host" = 'v1.formula-1.api-sports.io'      WHERE "key" IS NULL AND ("name" ILIKE '%f_rmula%' OR "name" ILIKE '%formula%' OR "name" ILIKE '%f1%');

-- Add new FixtureStatus values
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'QUARTER_1';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'QUARTER_2';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'QUARTER_3';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'QUARTER_4';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'OVERTIME';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'BREAK';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'SET_1';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'SET_2';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'SET_3';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'SET_4';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'SET_5';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'ROUND_1';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'ROUND_2';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'ROUND_3';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'ROUND_4';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'ROUND_5';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "FixtureStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- Add new MarketType values
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'BASKETBALL_WINNER';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'BASKETBALL_SPREAD';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'BASKETBALL_TOTAL';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'VOLLEYBALL_WINNER';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'VOLLEYBALL_TOTAL_SETS';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'VOLLEYBALL_HANDICAP';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'MMA_FIGHT_WINNER';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'MMA_METHOD_OF_VICTORY';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'MMA_TOTAL_ROUNDS';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'F1_RACE_WINNER';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'F1_PODIUM_FINISH';
ALTER TYPE "MarketType" ADD VALUE IF NOT EXISTS 'F1_FASTEST_LAP';

-- Seed sports (only insert those that don't already exist by name)
INSERT INTO "sports" ("name", "key", "api_host", "icon", "sort_order", "is_active", "created_at")
SELECT v.* FROM (VALUES
  ('Futebol',    'football',   'v3.football.api-sports.io',   '⚽',  1, true, NOW()),
  ('Basquete',   'basketball', 'v1.basketball.api-sports.io', '🏀', 2, true, NOW()),
  ('Vôlei',      'volleyball', 'v1.volleyball.api-sports.io', '🏐', 3, true, NOW()),
  ('MMA',        'mma',        'v1.mma.api-sports.io',        '🥊', 4, true, NOW()),
  ('Fórmula 1',  'formula1',   'v1.formula-1.api-sports.io',  '🏎️',  5, true, NOW())
) AS v("name", "key", "api_host", "icon", "sort_order", "is_active", "created_at")
WHERE NOT EXISTS (SELECT 1 FROM "sports" s WHERE s."name" = v."name");
