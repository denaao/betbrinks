import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: jest.Mocked<PrismaService>;
  let notifications: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            bet: {
              count: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            achievement: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            userAchievement: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            pointBalance: { update: jest.fn() },
            diamondPurchase: { findFirst: jest.fn() },
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendToUser: jest.fn(),
            notifyAchievement: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    prisma = module.get(PrismaService);
    notifications = module.get(NotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('grantXp', () => {
    it('should grant XP for bet placed (10 XP)', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, level: 1, xp: 60 } as any);

      const result = await service.grantXp(1, 'BET_PLACED');

      expect(result?.xpGranted).toBe(10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { xp: { increment: 10 } },
      });
    });

    it('should grant XP for bet won (25 XP)', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, level: 1, xp: 90 } as any);

      const result = await service.grantXp(1, 'BET_WON');

      expect(result?.xpGranted).toBe(25);
    });

    it('should level up when XP threshold reached', async () => {
      // Level 2 requires 100 XP, user now has 105
      prisma.user.update
        .mockResolvedValueOnce({ id: 1, level: 1, xp: 105 } as any) // after XP grant
        .mockResolvedValueOnce({ id: 1, level: 2, xp: 105 } as any); // after level update

      const result = await service.grantXp(1, 'BET_WON');

      expect(prisma.user.update).toHaveBeenCalledTimes(2);
      expect(notifications.sendToUser).toHaveBeenCalledWith(1, expect.objectContaining({
        title: 'Level Up!',
      }));
    });

    it('should not level up if below threshold', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, level: 1, xp: 50 } as any);

      await service.grantXp(1, 'DAILY_LOGIN');

      expect(prisma.user.update).toHaveBeenCalledTimes(1); // Only XP grant, no level update
    });
  });

  describe('getUserAchievements', () => {
    it('should return achievements with unlock status', async () => {
      prisma.achievement.findMany.mockResolvedValue([
        {
          id: 1, key: 'first_bet', name: 'Primeira Aposta', description: 'Faca sua primeira aposta',
          xpReward: 50, pointReward: 100, iconUrl: null,
          users: [{ unlockedAt: new Date() }],
        },
        {
          id: 2, key: 'lucky_3', name: 'Sortudo', description: 'Ganhe 3 seguidas',
          xpReward: 100, pointReward: 200, iconUrl: null,
          users: [],
        },
      ] as any);

      const result = await service.getUserAchievements(1);

      expect(result).toHaveLength(2);
      expect(result[0].unlocked).toBe(true);
      expect(result[1].unlocked).toBe(false);
    });
  });

  describe('getUserLevelInfo', () => {
    it('should return level progress', async () => {
      prisma.user.findUnique.mockResolvedValue({ level: 3, xp: 400 } as any);

      const result = await service.getUserLevelInfo(1);

      expect(result?.level).toBe(3);
      expect(result?.xp).toBe(400);
      expect(result?.xpInLevel).toBe(150); // 400 - 250 (level 3 threshold)
      expect(result?.xpNeeded).toBe(250); // 500 - 250
      expect(result?.progress).toBeCloseTo(0.6);
      expect(result?.nextLevel).toBe(4);
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserLevelInfo(999);
      expect(result).toBeNull();
    });
  });

  describe('checkAchievements', () => {
    it('should check first_bet on bet_placed trigger', async () => {
      prisma.userAchievement.findMany.mockResolvedValue([]); // no unlocked
      prisma.bet.count.mockResolvedValue(1); // 1 bet placed
      prisma.achievement.findUnique.mockResolvedValue({
        id: 1, key: 'first_bet', name: 'Primeira Aposta',
        xpReward: 50, pointReward: 100,
      } as any);

      const result = await service.checkAchievements(1, 'bet_placed');

      expect(result).toContain('first_bet');
      expect(prisma.userAchievement.create).toHaveBeenCalled();
      expect(notifications.notifyAchievement).toHaveBeenCalled();
    });

    it('should not re-unlock already unlocked achievement', async () => {
      prisma.userAchievement.findMany.mockResolvedValue([
        { achievement: { key: 'first_bet' } },
      ] as any);

      const result = await service.checkAchievements(1, 'bet_placed');

      // first_bet already unlocked, should not appear again
      expect(result).not.toContain('first_bet');
    });
  });
});
