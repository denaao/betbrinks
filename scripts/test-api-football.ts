/**
 * Script de teste de conexão com API-Football
 * Executa: npx ts-node scripts/test-api-football.ts
 * Ou: node scripts/test-api-football.js (após compilar)
 */

const API_KEY = process.env.API_FOOTBALL_KEY || '1447abd3d56c0fc2bdd5c4b908dad19b';
const BASE_URL = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

interface TestResult {
  name: string;
  success: boolean;
  data?: any;
  error?: string;
}

async function apiRequest(endpoint: string): Promise<any> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'x-apisports-key': API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function testAccountStatus(): Promise<TestResult> {
  try {
    const data = await apiRequest('/status');
    const account = data.response?.account;
    const subscription = data.response?.subscription;
    const requests = data.response?.requests;

    return {
      name: 'Account Status',
      success: true,
      data: {
        email: account?.email,
        plan: subscription?.plan,
        endDate: subscription?.end,
        requestsToday: requests?.current,
        requestsLimit: requests?.limit_day,
      },
    };
  } catch (error: any) {
    return { name: 'Account Status', success: false, error: error.message };
  }
}

async function testGetLeagues(): Promise<TestResult> {
  try {
    const data = await apiRequest('/leagues?country=Brazil&season=2025');
    const leagues = data.response || [];

    return {
      name: 'Brazilian Leagues (2025)',
      success: true,
      data: {
        totalLeagues: leagues.length,
        leagues: leagues.slice(0, 5).map((l: any) => ({
          id: l.league?.id,
          name: l.league?.name,
          type: l.league?.type,
        })),
      },
    };
  } catch (error: any) {
    return { name: 'Brazilian Leagues', success: false, error: error.message };
  }
}

async function testGetFixtures(): Promise<TestResult> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiRequest(`/fixtures?date=${today}&timezone=America/Sao_Paulo`);
    const fixtures = data.response || [];

    return {
      name: `Fixtures Today (${today})`,
      success: true,
      data: {
        totalFixtures: fixtures.length,
        samples: fixtures.slice(0, 3).map((f: any) => ({
          id: f.fixture?.id,
          home: f.teams?.home?.name,
          away: f.teams?.away?.name,
          league: f.league?.name,
          status: f.fixture?.status?.short,
          score: `${f.goals?.home ?? '-'} x ${f.goals?.away ?? '-'}`,
        })),
      },
    };
  } catch (error: any) {
    return { name: 'Fixtures Today', success: false, error: error.message };
  }
}

async function testGetOdds(): Promise<TestResult> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiRequest(`/odds?date=${today}&bookmaker=8&bet=1`);
    const odds = data.response || [];

    return {
      name: 'Odds (Match Winner)',
      success: true,
      data: {
        totalFixturesWithOdds: odds.length,
        sample: odds.length > 0 ? {
          fixtureId: odds[0].fixture?.id,
          bookmaker: odds[0].bookmakers?.[0]?.name,
          bets: odds[0].bookmakers?.[0]?.bets?.[0]?.values?.map((v: any) => ({
            name: v.value,
            odd: v.odd,
          })),
        } : null,
      },
    };
  } catch (error: any) {
    return { name: 'Odds', success: false, error: error.message };
  }
}

async function testGetLiveFixtures(): Promise<TestResult> {
  try {
    const data = await apiRequest('/fixtures?live=all');
    const fixtures = data.response || [];

    return {
      name: 'Live Fixtures',
      success: true,
      data: {
        totalLive: fixtures.length,
        samples: fixtures.slice(0, 3).map((f: any) => ({
          home: f.teams?.home?.name,
          away: f.teams?.away?.name,
          league: f.league?.name,
          minute: f.fixture?.status?.elapsed,
          score: `${f.goals?.home} x ${f.goals?.away}`,
        })),
      },
    };
  } catch (error: any) {
    return { name: 'Live Fixtures', success: false, error: error.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  BetBrinks - Teste de Conexão API-Football');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tests = [
    testAccountStatus,
    testGetLeagues,
    testGetFixtures,
    testGetOdds,
    testGetLiveFixtures,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test();

    if (result.success) {
      console.log(`✅ ${result.name}`);
      console.log(`   ${JSON.stringify(result.data, null, 2).split('\n').join('\n   ')}\n`);
      passed++;
    } else {
      console.log(`❌ ${result.name}`);
      console.log(`   Erro: ${result.error}\n`);
      failed++;
    }

    // Rate limit: espera 1s entre requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Resultado: ${passed} passou / ${failed} falhou`);
  console.log('═══════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
