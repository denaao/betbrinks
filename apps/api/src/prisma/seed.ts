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

  // Test user (dev only)
  const userHash = await bcryptjs.hash('teste123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'teste@betbrinks.com' },
    update: {},
    create: {
      name: 'Usuario Teste',
      email: 'teste@betbrinks.com',
      phone: '+5511999999999',
      passwordHash: userHash,
      isVerified: true,
    },
  });

  await prisma.pointBalance.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      points: 1000,
      diamonds: 0,
    },
  });

  await prisma.pointTransaction.create({
    data: {
      userId: user.id,
      type: 'INITIAL_BONUS',
      amount: 1000,
      balanceAfter: 1000,
      description: 'Bonus de boas-vindas',
    },
  });
  console.log('  ✅ Test user created (teste@betbrinks.com / teste123)');

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
