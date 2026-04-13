import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // System configs
  const configs = [
    { key: 'initial_points', value: '1000', type: 'number' },
    { key: 'daily_bonus_points', value: '50', type: 'number' },
    { key: 'max_daily_bets', value: '50', type: 'number' },
    { key: 'referral_reward_points', value: '500', type: 'number' },
    { key: 'referral_min_bets', value: '5', type: 'number' },
    { key: 'diamond_to_points_rate', value: '5', type: 'number' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log(`  ✅ ${configs.length} system configs created`);

  // Admin user
  const adminHash = await bcryptjs.hash('admin123', 12);
  await prisma.adminUser.upsert({
    where: { email: 'admin@betbrinks.com' },
    update: {},
    create: {
      email: 'admin@betbrinks.com',
      passwordHash: adminHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('  ✅ Admin user created (admin@betbrinks.com / admin123)');

  // Achievements
  const achievements = [
    { key: 'first_bet', name: 'Primeira Aposta', description: 'Faca sua primeira aposta', xpReward: 50, pointReward: 50 },
    { key: 'lucky_3', name: 'Sortudo', description: 'Acerte 3 apostas seguidas', xpReward: 100, pointReward: 200 },
    { key: 'faithful_7', name: 'Fiel', description: 'Login por 7 dias consecutivos', xpReward: 75, pointReward: 500 },
    { key: 'explorer_5', name: 'Explorador', description: 'Aposte em 5 ligas diferentes', xpReward: 80, pointReward: 300 },
    { key: 'social_3', name: 'Social', description: 'Convide 3 amigos que se cadastraram', xpReward: 150, pointReward: 1000 },
    { key: 'high_roller', name: 'High Roller', description: 'Aposte 10.000 pontos em um unico jogo', xpReward: 100, pointReward: 0 },
    { key: 'machine_100', name: 'Maquina', description: 'Faca 100 apostas no total', xpReward: 200, pointReward: 1500 },
    { key: 'oracle_10', name: 'Oracle', description: 'Acerte 10 apostas de odd > 3.00', xpReward: 200, pointReward: 2000 },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { key: ach.key },
      update: {},
      create: ach,
    });
  }
  console.log(`  ✅ ${achievements.length} achievements created`);

  // ─── Sports & Active Leagues ──────────────────────────────────────────
  const sportsData = [
    { name: 'Futebol', key: 'football', apiHost: 'v3.football.api-sports.io', icon: '⚽', sortOrder: 1 },
    { name: 'Basquete', key: 'basketball', apiHost: 'v1.basketball.api-sports.io', icon: '🏀', sortOrder: 2 },
    { name: 'Vôlei', key: 'volleyball', apiHost: 'v1.volleyball.api-sports.io', icon: '🏐', sortOrder: 3 },
    { name: 'MMA', key: 'mma', apiHost: '', icon: '🥊', sortOrder: 4 },
    { name: 'Fórmula 1', key: 'formula1', apiHost: 'v1.formula-1.api-sports.io', icon: '🏎️', sortOrder: 5 },
  ];

  for (const s of sportsData) {
    await prisma.sport.upsert({
      where: { key: s.key },
      update: { name: s.name, apiHost: s.apiHost, icon: s.icon, sortOrder: s.sortOrder },
      create: s,
    });
  }
  console.log(`  ✅ ${sportsData.length} sports created`);

  // Football leagues (API-Football IDs)
  const footballSport = await prisma.sport.findUnique({ where: { key: 'football' } });
  if (footballSport) {
    const footballLeagues = [
      { apiFootballId: 71, name: 'Brasileirão Série A', country: 'Brazil' },
      { apiFootballId: 72, name: 'Brasileirão Série B', country: 'Brazil' },
      { apiFootballId: 73, name: 'Copa do Brasil', country: 'Brazil' },
      { apiFootballId: 13, name: 'Copa Libertadores', country: 'South America' },
      { apiFootballId: 11, name: 'Copa Sul-Americana', country: 'South America' },
      { apiFootballId: 39, name: 'Premier League', country: 'England' },
      { apiFootballId: 140, name: 'La Liga', country: 'Spain' },
      { apiFootballId: 135, name: 'Serie A', country: 'Italy' },
      { apiFootballId: 78, name: 'Bundesliga', country: 'Germany' },
      { apiFootballId: 61, name: 'Ligue 1', country: 'France' },
      { apiFootballId: 2, name: 'Champions League', country: 'Europe' },
      { apiFootballId: 3, name: 'Europa League', country: 'Europe' },
      { apiFootballId: 1, name: 'Copa do Mundo', country: 'World' },
    ];
    for (const l of footballLeagues) {
      await prisma.activeLeague.upsert({
        where: { apiFootballId_sportId: { apiFootballId: l.apiFootballId, sportId: footballSport.id } },
        update: { name: l.name, country: l.country },
        create: { ...l, sportId: footballSport.id },
      });
    }
    console.log(`  ✅ ${footballLeagues.length} football leagues created`);
  }

  // Basketball leagues
  const basketSport = await prisma.sport.findUnique({ where: { key: 'basketball' } });
  if (basketSport) {
    const basketLeagues = [
      { apiFootballId: 12, name: 'NBB', country: 'Brazil' },
      { apiFootballId: 12, name: 'NBA', country: 'USA' },
    ];
    for (const l of basketLeagues) {
      await prisma.activeLeague.upsert({
        where: { apiFootballId_sportId: { apiFootballId: l.apiFootballId, sportId: basketSport.id } },
        update: { name: l.name, country: l.country },
        create: { ...l, sportId: basketSport.id },
      });
    }
    console.log(`  ✅ Basketball leagues created`);
  }

  // ─── Liga BetBrincadeira (singleton) ─────────────────────────────────────
  let ligaOficial = await prisma.league.findFirst({ where: { isOfficial: true } });
  if (!ligaOficial) {
    ligaOficial = await prisma.league.create({
      data: {
        name: 'Liga BetBrincadeira',
        inviteCode: 'OFICIAL',
        isOfficial: true,
        ownerId: null,
      },
    });
  }
  console.log(`  ✅ Liga BetBrincadeira created (ID: ${ligaOficial.id})`);

  // ─── Test user (dev only) ─────────────────────────────────────────
  const userHash = await bcryptjs.hash('teste123', 12);
  const testCpf = '529.982.247-25'; // valid test CPF

  // Try to find existing test user by phone or CPF
  let user = await prisma.user.findFirst({
    where: { OR: [{ phone: '+5511999999999' }, { cpf: testCpf }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Estefani',
        cpf: testCpf,
        email: 'teste@betbrinks.com',
        phone: '+5511999999999',
        passwordHash: userHash,
        isVerified: true,
      },
    });
  } else {
    // Update existing user to add CPF if missing
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        cpf: testCpf,
        passwordHash: userHash,
        isVerified: true,
      },
    });
  }

  // Global point balance
  await prisma.pointBalance.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      points: 1000,
      diamonds: 100,
    },
  });

  // Enroll in Liga BetBrincadeira
  await prisma.leagueMember.upsert({
    where: { leagueId_userId: { leagueId: ligaOficial.id, userId: user.id } },
    update: {},
    create: {
      leagueId: ligaOficial.id,
      userId: user.id,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });

  await prisma.leagueBalance.upsert({
    where: { leagueId_userId: { leagueId: ligaOficial.id, userId: user.id } },
    update: {},
    create: {
      leagueId: ligaOficial.id,
      userId: user.id,
      balance: 1000,
    },
  });

  console.log(`  ✅ Test user created (CPF: ${testCpf} / senha: teste123)`);

  // ─── Auto-enroll ALL existing users in Liga BetBrincadeira ─────────
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  let enrolled = 0;
  for (const u of allUsers) {
    const existing = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: ligaOficial.id, userId: u.id } },
    });
    if (!existing) {
      await prisma.leagueMember.create({
        data: {
          leagueId: ligaOficial.id,
          userId: u.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });
      await prisma.leagueBalance.upsert({
        where: { leagueId_userId: { leagueId: ligaOficial.id, userId: u.id } },
        create: { leagueId: ligaOficial.id, userId: u.id, balance: 1000 },
        update: {},
      });
      enrolled++;
    }
  }
  if (enrolled > 0) {
    console.log(`  ✅ Auto-enrolled ${enrolled} existing users in Liga BetBrincadeira`);
  }

  console.log('🌱 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
