-- ============================================================================
-- CONSOLIDADO: Tudo que faltou das migrations anteriores (que falharam)
-- ============================================================================

-- ─── 1) Colunas que faltaram na tabela sports ───────────────────────────────
ALTER TABLE "sports" ADD COLUMN IF NOT EXISTS "key" VARCHAR(30) UNIQUE;
ALTER TABLE "sports" ADD COLUMN IF NOT EXISTS "api_host" VARCHAR(200) NOT NULL DEFAULT '';

-- ─── 2) Coluna que faltou na tabela fixtures ────────────────────────────────
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "sport_key" VARCHAR(30) NOT NULL DEFAULT 'football';
CREATE INDEX IF NOT EXISTS "fixtures_sport_key_start_at_idx" ON "fixtures"("sport_key", "start_at");

-- ─── 3) Atualizar sports existentes para ter key e api_host ─────────────────
UPDATE "sports" SET "key" = 'football',   "api_host" = 'v3.football.api-sports.io'   WHERE "key" IS NULL AND ("name" ILIKE '%futebol%' OR "name" ILIKE '%football%');
UPDATE "sports" SET "key" = 'basketball', "api_host" = 'v1.basketball.api-sports.io' WHERE "key" IS NULL AND ("name" ILIKE '%basquete%' OR "name" ILIKE '%basketball%');
UPDATE "sports" SET "key" = 'volleyball', "api_host" = 'v1.volleyball.api-sports.io' WHERE "key" IS NULL AND ("name" ILIKE '%v_lei%' OR "name" ILIKE '%volleyball%');
UPDATE "sports" SET "key" = 'mma',        "api_host" = 'v1.mma.api-sports.io'        WHERE "key" IS NULL AND ("name" ILIKE '%mma%');
UPDATE "sports" SET "key" = 'formula1',   "api_host" = 'v1.formula-1.api-sports.io'  WHERE "key" IS NULL AND ("name" ILIKE '%f_rmula%' OR "name" ILIKE '%formula%' OR "name" ILIKE '%f1%');

-- Inserir sports que não existem ainda (checa por name E por key)
INSERT INTO "sports" ("name", "key", "api_host", "icon", "sort_order", "is_active", "created_at")
SELECT v.* FROM (VALUES
  ('Futebol',    'football',   'v3.football.api-sports.io',   '⚽',  1, true, NOW()),
  ('Basquete',   'basketball', 'v1.basketball.api-sports.io', '🏀', 2, true, NOW()),
  ('Vôlei',      'volleyball', 'v1.volleyball.api-sports.io', '🏐', 3, true, NOW()),
  ('MMA',        'mma',        'v1.mma.api-sports.io',        '🥊', 4, true, NOW()),
  ('Fórmula 1',  'formula1',   'v1.formula-1.api-sports.io',  '🏎️',  5, true, NOW())
) AS v("name", "key", "api_host", "icon", "sort_order", "is_active", "created_at")
WHERE NOT EXISTS (SELECT 1 FROM "sports" s WHERE s."name" = v."name" OR s."key" = v."key");

-- ─── 4) Enum values (IF NOT EXISTS é seguro para re-execução) ───────────────
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

-- ─── 5) Fix unique constraints ──────────────────────────────────────────────
DROP INDEX IF EXISTS "active_leagues_api_football_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "active_leagues_api_football_id_sport_id_key" ON "active_leagues"("api_football_id", "sport_id");

DROP INDEX IF EXISTS "fixtures_api_football_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "fixtures_api_football_id_sport_key_key" ON "fixtures"("api_football_id", "sport_key");

-- ─── 6) Limpar ligas de outros esportes que falharam no seed anterior ───────
DELETE FROM "active_leagues" WHERE "sport_id" IS NOT NULL AND "sport_id" != (SELECT id FROM sports WHERE key='football');

-- ─── 7) Seed BASKETBALL ────────────────────────────────────────────────────
INSERT INTO "active_leagues" ("api_football_id", "name", "country", "logo", "is_active", "sport_id", "created_at") VALUES
  (12,  'NBA',                        'USA',         'https://media.api-sports.io/basketball/leagues/12.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (13,  'WNBA',                       'USA',         'https://media.api-sports.io/basketball/leagues/13.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (116, 'NBA G-League',               'USA',         'https://media.api-sports.io/basketball/leagues/116.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (21,  'NCAA',                       'USA',         'https://media.api-sports.io/basketball/leagues/21.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (150, 'NBB',                        'Brazil',      'https://media.api-sports.io/basketball/leagues/150.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (15,  'Liga Nacional',              'Argentina',   'https://media.api-sports.io/basketball/leagues/15.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (155, 'LNB',                        'Mexico',      'https://media.api-sports.io/basketball/leagues/155.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (120, 'Euroleague',                 'Europe',      'https://media.api-sports.io/basketball/leagues/120.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (121, 'Eurocup',                    'Europe',      'https://media.api-sports.io/basketball/leagues/121.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (117, 'Liga ACB',                   'Spain',       'https://media.api-sports.io/basketball/leagues/117.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (82,  'Lega Basket Serie A',        'Italy',       'https://media.api-sports.io/basketball/leagues/82.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (52,  'LNB Pro A',                  'France',      'https://media.api-sports.io/basketball/leagues/52.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (38,  'BBL',                        'Germany',     'https://media.api-sports.io/basketball/leagues/38.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (79,  'BSL',                        'Turkey',      'https://media.api-sports.io/basketball/leagues/79.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (66,  'VTB United League',          'Russia',      'https://media.api-sports.io/basketball/leagues/66.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (55,  'Greek Basket League',        'Greece',      'https://media.api-sports.io/basketball/leagues/55.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (42,  'Superliga',                  'Serbia',      'https://media.api-sports.io/basketball/leagues/42.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (17,  'NBL',                        'Australia',   'https://media.api-sports.io/basketball/leagues/17.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (25,  'CBA',                        'China',       'https://media.api-sports.io/basketball/leagues/25.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (110, 'KBL',                        'South Korea', 'https://media.api-sports.io/basketball/leagues/110.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (106, 'B.League',                   'Japan',       'https://media.api-sports.io/basketball/leagues/106.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (30,  'PBA',                        'Philippines', 'https://media.api-sports.io/basketball/leagues/30.png',  false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (122, 'FIBA World Cup',             'World',       'https://media.api-sports.io/basketball/leagues/122.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (123, 'FIBA AmeriCup',              'World',       'https://media.api-sports.io/basketball/leagues/123.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (124, 'FIBA EuroBasket',            'Europe',      'https://media.api-sports.io/basketball/leagues/124.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW()),
  (125, 'Olympic Games',              'World',       'https://media.api-sports.io/basketball/leagues/125.png', false, (SELECT id FROM sports WHERE key='basketball'), NOW())
ON CONFLICT ("api_football_id", "sport_id") DO NOTHING;

-- ─── 8) Seed VOLLEYBALL ────────────────────────────────────────────────────
INSERT INTO "active_leagues" ("api_football_id", "name", "country", "logo", "is_active", "sport_id", "created_at") VALUES
  (1,   'Nations League - Men',        'World',       'https://media.api-sports.io/volleyball/leagues/1.png',   false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (2,   'Nations League - Women',      'World',       'https://media.api-sports.io/volleyball/leagues/2.png',   false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (3,   'World Championship - Men',    'World',       'https://media.api-sports.io/volleyball/leagues/3.png',   false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (4,   'World Championship - Women',  'World',       'https://media.api-sports.io/volleyball/leagues/4.png',   false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (5,   'Olympic Games - Men',         'World',       'https://media.api-sports.io/volleyball/leagues/5.png',   false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (6,   'Olympic Games - Women',       'World',       'https://media.api-sports.io/volleyball/leagues/6.png',   false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (10,  'CEV Champions League - Men',  'Europe',      'https://media.api-sports.io/volleyball/leagues/10.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (11,  'CEV Champions League - Women','Europe',      'https://media.api-sports.io/volleyball/leagues/11.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (32,  'SuperLega',                    'Italy',       'https://media.api-sports.io/volleyball/leagues/32.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (33,  'Serie A1 - Women',            'Italy',       'https://media.api-sports.io/volleyball/leagues/33.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (36,  'PlusLiga',                     'Poland',      'https://media.api-sports.io/volleyball/leagues/36.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (25,  'Ligue A - Men',               'France',      'https://media.api-sports.io/volleyball/leagues/25.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (22,  'Bundesliga - Men',            'Germany',     'https://media.api-sports.io/volleyball/leagues/22.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (39,  'Efeler Ligi',                 'Turkey',      'https://media.api-sports.io/volleyball/leagues/39.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (45,  'Superliga - Men',             'Russia',      'https://media.api-sports.io/volleyball/leagues/45.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (30,  'Superliga - Men',             'Brazil',      'https://media.api-sports.io/volleyball/leagues/30.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (31,  'Superliga - Women',           'Brazil',      'https://media.api-sports.io/volleyball/leagues/31.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (50,  'Liga A1 - Men',               'Argentina',   'https://media.api-sports.io/volleyball/leagues/50.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (60,  'V.League - Men',              'Japan',       'https://media.api-sports.io/volleyball/leagues/60.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (65,  'V-League',                     'South Korea', 'https://media.api-sports.io/volleyball/leagues/65.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW()),
  (80,  'Beach Volleyball World Tour', 'World',       'https://media.api-sports.io/volleyball/leagues/80.png',  false, (SELECT id FROM sports WHERE key='volleyball'), NOW())
ON CONFLICT ("api_football_id", "sport_id") DO NOTHING;

-- ─── 9) Seed MMA ───────────────────────────────────────────────────────────
INSERT INTO "active_leagues" ("api_football_id", "name", "country", "logo", "is_active", "sport_id", "created_at") VALUES
  (1,   'UFC',                         'USA',         'https://media.api-sports.io/mma/leagues/1.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (2,   'Bellator MMA',                'USA',         'https://media.api-sports.io/mma/leagues/2.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (3,   'ONE Championship',            'Singapore',   'https://media.api-sports.io/mma/leagues/3.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (4,   'PFL',                          'USA',         'https://media.api-sports.io/mma/leagues/4.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (5,   'Cage Warriors',               'UK',          'https://media.api-sports.io/mma/leagues/5.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (6,   'KSW',                          'Poland',      'https://media.api-sports.io/mma/leagues/6.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (7,   'RIZIN',                        'Japan',       'https://media.api-sports.io/mma/leagues/7.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (8,   'Invicta FC',                   'USA',         'https://media.api-sports.io/mma/leagues/8.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (9,   'LFA',                          'USA',         'https://media.api-sports.io/mma/leagues/9.png',          false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (10,  'ARES',                         'France',      'https://media.api-sports.io/mma/leagues/10.png',         false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (11,  'Dana White Contender Series',  'USA',         'https://media.api-sports.io/mma/leagues/11.png',         false, (SELECT id FROM sports WHERE key='mma'), NOW()),
  (12,  'UFC Fight Night',              'USA',         'https://media.api-sports.io/mma/leagues/12.png',         false, (SELECT id FROM sports WHERE key='mma'), NOW())
ON CONFLICT ("api_football_id", "sport_id") DO NOTHING;

-- ─── 10) Seed FORMULA 1 ────────────────────────────────────────────────────
INSERT INTO "active_leagues" ("api_football_id", "name", "country", "logo", "is_active", "sport_id", "created_at") VALUES
  (1,   'Formula 1 World Championship','World',       'https://media.api-sports.io/formula-1/leagues/1.png',    false, (SELECT id FROM sports WHERE key='formula1'), NOW()),
  (2,   'Formula 2',                    'World',       'https://media.api-sports.io/formula-1/leagues/2.png',    false, (SELECT id FROM sports WHERE key='formula1'), NOW()),
  (3,   'Formula 3',                    'World',       'https://media.api-sports.io/formula-1/leagues/3.png',    false, (SELECT id FROM sports WHERE key='formula1'), NOW()),
  (4,   'Formula E',                    'World',       'https://media.api-sports.io/formula-1/leagues/4.png',    false, (SELECT id FROM sports WHERE key='formula1'), NOW())
ON CONFLICT ("api_football_id", "sport_id") DO NOTHING;
