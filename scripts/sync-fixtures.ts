/**
 * Sync manual de fixtures da API-Football para o banco
 * Executa: npx tsx scripts/sync-fixtures.ts
 */

import { PrismaClient } from '@prisma/client';

const API_KEY = '1447abd3d56c0fc2bdd5c4b908dad19b';
const BASE_URL = 'https://v3.football.api-sports.io';

const prisma = new PrismaClient();

const STATUS_MAP: Record<string, string> = {
  TBD: 'NOT_STARTED', NS: 'NOT_STARTED',
  '1H': 'LIVE_1H', HT: 'HALFTIME', '2H': 'LIVE_2H',
  ET: 'LIVE_2H', BT: 'HALFTIME', P: 'LIVE_2H',
  FT: 'FINISHED', AET: 'FINISHED', PEN: 'FINISHED',
  SUSP: 'SUSPENDED', INT: 'SUSPENDED',
  PST: 'POSTPONED', CANC: 'CANCELLED',
  ABD: 'ABANDONED', AWD: 'FINISHED', WO: 'FINISHED',
  LIVE: 'LIVE_1H',
};

async function apiRequest(endpoint: string) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  return res.json();
}

async function syncFixtures() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 Buscando fixtures do dia ${today}...`);

  const data: any = await apiRequest(`/fixtures?date=${today}&timezone=America/Sao_Paulo`);
  const fixtures = data.response || [];
  console.log(`   ${fixtures.length} fixtures encontradas na API-Football`);

  let created = 0;
  let updated = 0;

  for (const item of fixtures) {
    const f = item.fixture;
    const teams = item.teams;
    const goals = item.goals;
    const league = item.league;
    const status = STATUS_MAP[f.status.short] || 'NOT_STARTED';

    try {
      const existing = await prisma.fixture.findFirst({
        where: { apiFootballId: f.id },
      });

      const fixtureData = {
        apiFootballId: f.id,
        homeTeam: teams.home.name,
        awayTeam: teams.away.name,
        homeScore: goals.home,
        awayScore: goals.away,
        league: league.name,
        leagueId: league.id,
        season: league.season,
        date: new Date(f.date),
        status,
      };

      if (existing) {
        await prisma.fixture.update({
          where: { id: existing.id },
          data: fixtureData,
        });
        updated++;
      } else {
        await prisma.fixture.create({ data: fixtureData });
        created++;
      }
    } catch (err: any) {
      // skip duplicates
    }
  }

  console.log(`   ✅ ${created} criadas, ${updated} atualizadas`);
  return fixtures.length;
}

async function syncOdds() {
  console.log(`\n🎯 Buscando odds...`);

  const today = new Date().toISOString().split('T')[0];
  const data: any = await apiRequest(`/odds?date=${today}&bookmaker=8`);
  const oddsData = data.response || [];
  console.log(`   ${oddsData.length} fixtures com odds`);

  let oddsCreated = 0;

  for (const item of oddsData) {
    const fixtureApiId = item.fixture.id;

    const fixture = await prisma.fixture.findFirst({
      where: { apiFootballId: fixtureApiId },
    });
    if (!fixture) continue;

    for (const bookmaker of item.bookmakers || []) {
      for (const bet of bookmaker.bets || []) {
        // bet.id: 1 = Match Winner, 5 = Over/Under, 8 = Both Teams Score
        let marketType: string | null = null;
        if (bet.id === 1) marketType = 'MATCH_WINNER';
        else if (bet.id === 5) marketType = 'OVER_UNDER_25';
        else if (bet.id === 8) marketType = 'BOTH_TEAMS_SCORE';
        else continue;

        // Upsert market
        let market = await prisma.market.findFirst({
          where: { fixtureId: fixture.id, type: marketType },
        });

        if (!market) {
          market = await prisma.market.create({
            data: { fixtureId: fixture.id, type: marketType, active: true },
          });
        }

        // Upsert odds
        for (const val of bet.values || []) {
          let oddName = val.value;
          // Traduzir pra português
          if (marketType === 'MATCH_WINNER') {
            if (oddName === 'Home') oddName = 'Casa';
            else if (oddName === 'Draw') oddName = 'Empate';
            else if (oddName === 'Away') oddName = 'Fora';
          } else if (marketType === 'OVER_UNDER_25') {
            if (oddName === 'Over 2.5') oddName = 'Mais de 2.5';
            else if (oddName === 'Under 2.5') oddName = 'Menos de 2.5';
            else continue;
          } else if (marketType === 'BOTH_TEAMS_SCORE') {
            if (oddName === 'Yes') oddName = 'Sim';
            else if (oddName === 'No') oddName = 'Nao';
          }

          const oddValue = parseFloat(val.odd);

          const existingOdd = await prisma.odd.findFirst({
            where: { fixtureId: fixture.id, marketId: market.id, name: oddName },
          });

          if (existingOdd) {
            await prisma.odd.update({
              where: { id: existingOdd.id },
              data: { value: oddValue },
            });
          } else {
            await prisma.odd.create({
              data: {
                fixtureId: fixture.id,
                marketId: market.id,
                name: oddName,
                value: oddValue,
              },
            });
            oddsCreated++;
          }
        }
      }
    }
  }

  console.log(`   ✅ ${oddsCreated} odds criadas/atualizadas`);
}

async function syncLive() {
  console.log(`\n🔴 Buscando jogos ao vivo...`);

  const data: any = await apiRequest('/fixtures?live=all');
  const fixtures = data.response || [];
  console.log(`   ${fixtures.length} jogos ao vivo`);

  let updated = 0;
  for (const item of fixtures) {
    const existing = await prisma.fixture.findFirst({
      where: { apiFootballId: item.fixture.id },
    });

    if (existing) {
      await prisma.fixture.update({
        where: { id: existing.id },
        data: {
          status: STATUS_MAP[item.fixture.status.short] || existing.status,
          homeScore: item.goals.home,
          awayScore: item.goals.away,
        },
      });
      updated++;
    }
  }

  console.log(`   ✅ ${updated} jogos ao vivo atualizados no banco`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  BetBrinks - Sync Manual de Fixtures & Odds');
  console.log('═══════════════════════════════════════════════════════════\n');

  await syncFixtures();

  // Wait 1s to respect rate limits
  await new Promise(r => setTimeout(r, 1000));
  await syncOdds();

  await new Promise(r => setTimeout(r, 1000));
  await syncLive();

  // Summary
  const fixtureCount = await prisma.fixture.count();
  const marketCount = await prisma.market.count();
  const oddCount = await prisma.odd.count();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  📊 Banco: ${fixtureCount} fixtures, ${marketCount} mercados, ${oddCount} odds`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(console.error);
