import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PointsService } from './points.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PointsService', () => {
  let service: PointsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockBalance = {
    id: 1,
    userId: 1,
    points: 1000,
    diamonds: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 1,
    name: 'Teste',
    email: 'teste@email.com',
    phone: '+5511999999999',
    passwordHash: 'hash',
    avatarUrl: null,
    isVerified: true,
    level: 1,
    xp: 0,
    role: 'USER',
    lastLoginAt: null,
    lastBonusAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaTx = {
    pointBalance: {
      update: jest.fn(),
    },
    pointTransaction: {
      create: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        {
          provide: PrismaService,
          useValue: {
            pointBalance: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            pointTransaction: {
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(mockPrismaTx)),
          },
        },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getBalance ────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return points and diamonds', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(mockBalance as any);

      const result = await service.getBalance(1);

      expect(result).toEqual({ points: 1000, diamonds: 50 });
    });

    it('should throw NotFoundException if no balance', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(null);

      await expect(service.getBalance(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getTransactions ───────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTx = [
        { id: 1, userId: 1, type: 'DAILY_BONUS', amount: 50, balanceAfter: 1050, description: 'Bonus', createdAt: new Date() },
        { id: 2, userId: 1, type: 'BET_PLACED', amount: -100, balanceAfter: 950, description: 'Aposta', createdAt: new Date() },
      ];
      prisma.pointTransaction.findMany.mockResolvedValue(mockTx as any);
      prisma.pointTransaction.count.mockResolvedValue(2);

      const result = await service.getTransactions(1, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate correct pagination', async () => {
      prisma.pointTransaction.findMany.mockResolvedValue([]);
      prisma.pointTransaction.count.mockResolvedValue(45);

      const result = await service.getTransactions(1, 2, 20);

      expect(result.totalPages).toBe(3); // ceil(45/20) = 3
      expect(result.page).toBe(2);
      expect(prisma.pointTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });
  });

  // ─── collectDailyBonus ─────────────────────────────────────────────────

  describe('collectDailyBonus', () => {
    it('should collect daily bonus successfully (first time)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lastBonusAt: null } as any);
      mockPrismaTx.pointBalance.update.mockResolvedValue({ ...mockBalance, points: 1050 });

      const result = await service.collectDailyBonus(1);

      expect(result.pointsAdded).toBe(50);
      expect(result.newBalance).toBe(1050);
      expect(result.message).toContain('50');
    });

    it('should collect bonus if last was yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lastBonusAt: yesterday } as any);
      mockPrismaTx.pointBalance.update.mockResolvedValue({ ...mockBalance, points: 1050 });

      const result = await service.collectDailyBonus(1);

      expect(result.pointsAdded).toBe(50);
    });

    it('should throw if already collected today', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lastBonusAt: new Date() } as any);

      await expect(service.collectDailyBonus(1)).rejects.toThrow(BadRequestException);
      await expect(service.collectDailyBonus(1)).rejects.toThrow('ja coletado');
    });

    it('should throw if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.collectDailyBonus(999)).rejects.toThrow(NotFoundException);
    });

    it('should update lastBonusAt in transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lastBonusAt: null } as any);
      mockPrismaTx.pointBalance.update.mockResolvedValue({ ...mockBalance, points: 1050 });

      await service.collectDailyBonus(1);

      expect(mockPrismaTx.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastBonusAt: expect.any(Date) },
      });
    });
  });

  // ─── convertDiamonds ───────────────────────────────────────────────────

  describe('convertDiamonds', () => {
    it('should convert diamonds to points (5:1 rate)', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(mockBalance as any);
      mockPrismaTx.pointBalance.update.mockResolvedValue({
        ...mockBalance,
        diamonds: 40,
        points: 1050,
      });

      const result = await service.convertDiamonds(1, { diamonds: 10 });

      expect(result.diamondsUsed).toBe(10);
      expect(result.pointsAdded).toBe(50); // 10 * 5
      expect(result.newBalance.points).toBe(1050);
      expect(result.newBalance.diamonds).toBe(40);
    });

    it('should throw if insufficient diamonds', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue({ ...mockBalance, diamonds: 5 } as any);

      await expect(service.convertDiamonds(1, { diamonds: 10 })).rejects.toThrow(BadRequestException);
      await expect(service.convertDiamonds(1, { diamonds: 10 })).rejects.toThrow('insuficientes');
    });

    it('should throw if balance not found', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(null);

      await expect(service.convertDiamonds(1, { diamonds: 10 })).rejects.toThrow(NotFoundException);
    });

    it('should create transaction record', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(mockBalance as any);
      mockPrismaTx.pointBalance.update.mockResolvedValue({ ...mockBalance, diamonds: 30, points: 1100 });

      await service.convertDiamonds(1, { diamonds: 20 });

      expect(mockPrismaTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          type: 'DIAMOND_CONVERSION',
          amount: 100, // 20 * 5
        }),
      });
    });
  });

  // ─── creditPoints ──────────────────────────────────────────────────────

  describe('creditPoints', () => {
    it('should credit points and create transaction', async () => {
      mockPrismaTx.pointBalance.update.mockResolvedValue({ ...mockBalance, points: 1200 });

      const result = await service.creditPoints(1, 200, 'BET_WON', 'Aposta ganha');

      expect(result.points).toBe(1200);
      expect(mockPrismaTx.pointBalance.update).toHaveBeenCalledWith({
        where: { userId: 1 },
        data: { points: { increment: 200 } },
      });
      expect(mockPrismaTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          type: 'BET_WON',
          amount: 200,
          description: 'Aposta ganha',
        }),
      });
    });
  });

  // ─── debitPoints ───────────────────────────────────────────────────────

  describe('debitPoints', () => {
    it('should debit points and create transaction', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(mockBalance as any);
      mockPrismaTx.pointBalance.update.mockResolvedValue({ ...mockBalance, points: 900 });

      const result = await service.debitPoints(1, 100, 'BET_PLACED', 'Aposta feita');

      expect(result.points).toBe(900);
      expect(mockPrismaTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: -100,
          type: 'BET_PLACED',
        }),
      });
    });

    it('should throw if insufficient points', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue({ ...mockBalance, points: 50 } as any);

      await expect(service.debitPoints(1, 100, 'BET_PLACED', 'Aposta')).rejects.toThrow(BadRequestException);
      await expect(service.debitPoints(1, 100, 'BET_PLACED', 'Aposta')).rejects.toThrow('insuficientes');
    });

    it('should throw if balance not found', async () => {
      prisma.pointBalance.findUnique.mockResolvedValue(null);

      await expect(service.debitPoints(1, 100, 'BET_PLACED', 'Aposta')).rejects.toThrow(BadRequestException);
    });
  });
});
