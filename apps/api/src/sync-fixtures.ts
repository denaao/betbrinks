import { PrismaClient } from '@prisma/client';

const API_KEY = '1447abd3d56c0fc2bdd5c4b908dad19b';
const BASE_URL = 'https://v3.football.api-sports.io';

const prisma = new PrismaClient();

const STATUS_MAP: Record<string, string> = {
  TBD: 'NOT_STARTED', NS: 'NOT_STARTED',
  '1H': 'FIRST_HALF', HT: 'HALFTIME', '2H': 'SECOND_HALF',
  ET: 'EXTRA_TIME', BT: 'HALFTIME', P: 'PENALTIES',
  FT: 'FINISHED', AET: 'FINISHED', PEN: 'FINISHED',
  SUSP: 'NOT_STARTED', INT: 'NOT_STARTED',
  PST: 'POSTPONED', CANC: 'CANCELLED',
  ABD: 'CANCELLED', AWD: 'FINISHED', WO: 'FINISHED',
  LIVE: 'FIRST_HALF',
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
  let errors = 0;

  for (const item of fixtures) {
    const f = item.fixture;
    const teams = item.teams;
    const goals = item.goals;
    const league = item.league;
    const status = STATUS_MAP[f.status.short] || 'NOT_STARTED';

    const fixtureData = {
      apiFootballId: f.id,
      homeTeam: teams.home.name,
      homeLogo: teams.home.logo || null,
      awayTeam: teams.away.name,
      awayLogo: teams.away.logo || null,
      leagueName: league.name,
      leagueLogo: league.logo || null,
      leagueId: league.id,
      startAt: new Date(f.date),
      status: status as any,
      scoreHome: goals.home,
      scoreAway: goals.away,
    };

    try {
      const existing = await prisma.fixture.findUnique({
        where: { apiFootballId: f.id },
      });

      if (existing) {
        await prisma.fixture.update({
          where: { id: existing.id },
          data: {
            status: fixtureData.status,
            scoreHome: fixtureData.scoreHome,
            scoreAway: fixtureData.scoreAway,
            homeLogo: fixtureData.homeLogo,
            awayLogo: fixtureData.awayLogo,
            leagueLogo: fixtureData.leagueLogo,
          },
        });
        updated++;
      } else {
        await prisma.fixture.create({ data: fixtureData });
        created++;
      }
    } catch (err: any) {
      errors++;
      if (errors <= 3) console.log(`   ⚠️ Erro fixture ${f.id}: ${err.message?.slice(0, 100)}`);
    }
  }

  console.log(`   ✅ ${created} criadas, ${updated} atualizadas${errors ? `, ${errors} erros` : ''}`);
}

async function syncOdds() {
  console.log(`\n🎯 Buscando odds...`);

  const today = new Date().toISOString().split('T')[0];
  const data: any = await apiRequest(`/odds?date=${today}&bookmaker=8`);
  const oddsData = data.response || [];
  console.log(`   ${oddsData.length} fixtures com odds`);

  let oddsCreated = 0;
  let oddsUpdated = 0;

  for (const item of oddsData) {
    const fixtureApiId = item.fixture.id;

    const fixture = await prisma.fixture.findUnique({
      where: { apiFootballId: fixtureApiId },
    });
    if (!fixture) continue;

    for (const bookmaker of item.bookmakers || []) {
      for (const bet of bookmaker.bets || []) {
        let marketType: string | null = null;
        if (bet.id === 1) marketType = 'MATCH_WINNER';
        else if (bet.id === 5) marketType = 'OVER_UNDER_25';
        else if (bet.id === 8) marketType = 'BOTH_TEAMS_SCORE';
        else continue;

        let market = await prisma.market.findUnique({
          where: { fixtureId_type: { fixtureId: fixture.id, type: marketType as any } },
        });

        if (!market) {
          market = await prisma.market.create({
            data: { fixtureId: fixture.id, type: marketType as any, status: 'active' },
          });
        }

        for (const val of bet.values || []) {
          let oddName = val.value;
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

          try {
            const existingOdd = await prisma.odd.findUnique({
              where: { marketId_name: { marketId: market.id, name: oddName } },
            });

            if (existingOdd) {
              await prisma.odd.update({
                where: { id: existingOdd.id },
                data: { value: oddValue },
              });
              oddsUpdated++;
            } else {
              await prisma.odd.create({
                data: { marketId: market.id, name: oddName, value: oddValue },
              });
              oddsCreated++;
            }
          } catch (err: any) {
            // skip
          }
        }
      }
    }
  }

  console.log(`   ✅ ${oddsCreated} odds criadas, ${oddsUpdated} atualizadas`);
}

async function syncLive() {
  console.log(`\n🔴 Buscando jogos ao vivo...`);

  const data: any = await apiRequest('/fixtures?live=all');
  const fixtures = data.response || [];
  console.log(`   ${fixtures.length} jogos ao vivo`);

  let updated = 0;
  for (const item of fixtures) {
    const status = STATUS_MAP[item.fixture.status.short] || 'FIRST_HALF';
    try {
      const result = await prisma.fixture.updateMany({
        where: { apiFootballId: item.fixture.id },
        data: {
          status: status as any,
          scoreHome: item.goals.home,
          scoreAway: item.goals.away,
        },
      });
      if (result.count > 0) updated++;
    } catch {
      // fixture not in our db
    }
  }

  console.log(`   ✅ ${updated} jogos ao vivo atualizados no banco`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  BetBrinks - Sync Manual de Fixtures & Odds');
  console.log('═══════════════════════════════════════════════════════════\n');

  await syncFixtures();
  await new Promise(r => setTimeout(r, 1000));
  await syncOdds();
  await new Promise(r => setTimeout(r, 1000));
  await syncLive();

  const fixtureCount = await prisma.fixture.count();
  const marketCount = await prisma.market.count();
  const oddCount = await prisma.odd.count();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  📊 Banco: ${fixtureCount} fixtures, ${marketCount} mercados, ${oddCount} odds`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(console.error);
