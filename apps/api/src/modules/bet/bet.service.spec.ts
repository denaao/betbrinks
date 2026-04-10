import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BetService } from './bet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { RedisService } from '../../common/redis/redis.service';

describe('BetService', () => {
  let service: BetService;
  let prisma: jest.Mocked<PrismaService>;
  let pointsService: jest.Mocked<PointsService>;
  let redis: jest.Mocked<RedisService>;

  const mockFixture = {
    id: 1,
    apiFootballId: 12345,
    leagueId: 1,
    leagueName: 'Brasil - Serie A',
    leagueLogo: null,
    homeTeam: 'Flamengo',
    homeLogo: null,
    awayTeam: 'Palmeiras',
    awayLogo: null,
    startAt: new Date('2026-04-10T20:00:00Z'),
    status: 'NOT_STARTED',
    scoreHome: null,
    scoreAway: null,
    isSettled: false,
    updatedAt: new Date(),
  };

  const mockOdd = {
    id: 1,
    marketId: 1,
    name: 'Casa',
    value: 2.10,
    market: {
      id: 1,
      fixtureId: 1,
      type: 'MATCH_WINNER',
      status: 'active',
      result: null,
    },
  };

  const mockBet = {
    id: 1,
    userId: 1,
    fixtureId: 1,
    oddId: 1,
    amount: 100,
    oddValue: 2.10,
    potentialReturn: 210,
    status: 'PENDING',
    settledAt: null,
    createdAt: new Date(),
    fixture: {
      homeTeam: 'Flamengo',
      awayTeam: 'Palmeiras',
      leagueName: 'Brasil - Serie A',
      startAt: new Date('2026-04-10T20:00:00Z'),
      status: 'NOT_STARTED',
    },
    odd: {
      name: 'Casa',
      value: 2.10,
      market: { type: 'MATCH_WINNER' },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetService,
        {
          provide: PrismaService,
          useValue: {
            fixture: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            odd: {
              findUnique: jest.fn(),
            },
            bet: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            market: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: PointsService,
          useValue: {
            debitPoints: jest.fn(),
            creditPoints: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BetService>(BetService);
    prisma = module.get(PrismaService);
    pointsService = module.get(PointsService);
    redis = module.get(RedisService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createBet ─────────────────────────────────────────────────────────

  describe('createBet', () => {
    const dto = { fixtureId: 1, oddId: 1, amount: 100 };

    it('should create a bet successfully', async () => {
      redis.get.mockResolvedValue(null); // no daily limit
      prisma.fixture.findUnique.mockResolvedValue(mockFixture as any);
      prisma.odd.findUnique.mockResolvedValue(mockOdd as any);
      prisma.bet.findFirst.mockResolvedValue(null); // no duplicate
      pointsService.debitPoints.mockResolvedValue({ points: 900 } as any);
      prisma.bet.create.mockResolvedValue(mockBet as any);
      redis.incr.mockResolvedValue(1);

      const result = await service.createBet(1, dto);

      expect(result.id).toBe(1);
      expect(result.amount).toBe(100);
      expect(result.oddValue).toBe(2.10);
      expect(result.potentialReturn).toBe(210);
      expect(pointsService.debitPoints).toHaveBeenCalledWith(
        1, 100, 'BET_PLACED',
        expect.stringContaining('Flamengo'),
      );
    });

    it('should throw if fixture not found', async () => {
      redis.get.mockResolvedValue(null);
      prisma.fixture.findUnique.mockResolvedValue(null);

      await expect(service.createBet(1, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw if fixture already started', async () => {
      redis.get.mockResolvedValue(null);
      prisma.fixture.findUnique.mockResolvedValue({ ...mockFixture, status: 'FIRST_HALF' } as any);

      await expect(service.createBet(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.createBet(1, dto)).rejects.toThrow('antes do jogo iniciar');
    });

    it('should throw if odd not found', async () => {
      redis.get.mockResolvedValue(null);
      prisma.fixture.findUnique.mockResolvedValue(mockFixture as any);
      prisma.odd.findUnique.mockResolvedValue(null);

      await expect(service.createBet(1, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw if odd belongs to different fixture', async () => {
      redis.get.mockResolvedValue(null);
      prisma.fixture.findUnique.mockResolvedValue(mockFixture as any);
      prisma.odd.findUnique.mockResolvedValue({
        ...mockOdd,
        market: { ...mockOdd.market, fixtureId: 99 },
      } as any);

      await expect(service.createBet(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.createBet(1, dto)).rejects.toThrow('nao pertence');
    });

    it('should throw if market is suspended', async () => {
      redis.get.mockResolvedValue(null);
      prisma.fixture.findUnique.mockResolvedValue(mockFixture as any);
      prisma.odd.findUnique.mockResolvedValue({
        ...mockOdd,
        market: { ...mockOdd.market, status: 'suspended' },
      } as any);

      await expect(service.createBet(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.createBet(1, dto)).rejects.toThrow('suspenso');
    });

    it('should throw if duplicate pending bet exists', async () => {
      redis.get.mockResolvedValue(null);
      prisma.fixture.findUnique.mockResolvedValue(mockFixture as any);
      prisma.odd.findUnique.mockResolvedValue(mockOdd as any);
      prisma.bet.findFirst.mockResolvedValue(mockBet as any);

      await expect(service.createBet(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.createBet(1, dto)).rejects.toThrow('ja tem uma aposta');
    });

    it('should throw if daily limit reached', async () => {
      redis.get.mockResolvedValue('50'); // MAX_DAILY_BETS

      await expect(service.createBet(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.createBet(1, dto)).rejects.toThrow('Limite diario');
    });
  });

  // ─── getActiveBets ─────────────────────────────────────────────────────

  describe('getActiveBets', () => {
    it('should return pending bets for user', async () => {
      prisma.bet.findMany.mockResolvedValue([mockBet] as any);

      const result = await service.getActiveBets(1);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
      expect(prisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, status: 'PENDING' } }),
      );
    });
  });

  // ─── getBetHistory ─────────────────────────────────────────────────────

  describe('getBetHistory', () => {
    it('should return paginated settled bets', async () => {
      prisma.bet.findMany.mockResolvedValue([{ ...mockBet, status: 'WON' }] as any);
      prisma.bet.count.mockResolvedValue(1);

      const result = await service.getBetHistory(1, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  // ─── settleBets ────────────────────────────────────────────────────────

  describe('settleBets', () => {
    it('should settle bets correctly — home win', async () => {
      const finishedFixture = { ...mockFixture, status: 'FINISHED', scoreHome: 2, scoreAway: 1, isSettled: false };
      prisma.fixture.findUnique.mockResolvedValue(finishedFixture as any);

      const pendingBets = [
        { ...mockBet, id: 1, userId: 1, potentialReturn: 210, odd: { name: 'Casa', market: { type: 'MATCH_WINNER' } } },
        { ...mockBet, id: 2, userId: 2, potentialReturn: 300, odd: { name: 'Fora', market: { type: 'MATCH_WINNER' } } },
      ];
      prisma.bet.findMany.mockResolvedValue(pendingBets as any);
      prisma.market.findMany.mockResolvedValue([{ id: 1, type: 'MATCH_WINNER', fixtureId: 1 }] as any);
      prisma.bet.update.mockResolvedValue({} as any);
      prisma.market.update.mockResolvedValue({} as any);
      prisma.fixture.update.mockResolvedValue({} as any);
      pointsService.creditPoints.mockResolvedValue({} as any);

      const result = await service.settleBets(1);

      expect(result.won).toBe(1);   // 'Casa' bet won
      expect(result.lost).toBe(1);  // 'Fora' bet lost
      expect(result.score).toBe('2 - 1');
      expect(pointsService.creditPoints).toHaveBeenCalledTimes(1);
      expect(pointsService.creditPoints).toHaveBeenCalledWith(
        1, 210, 'BET_WON',
        expect.any(String),
        'bet:1',
      );
    });

    it('should settle OVER_UNDER_25 correctly', async () => {
      const fixture = { ...mockFixture, status: 'FINISHED', scoreHome: 2, scoreAway: 2, isSettled: false };
      prisma.fixture.findUnique.mockResolvedValue(fixture as any);

      // Total goals = 4, so Over 2.5 wins
      const pendingBets = [
        { ...mockBet, id: 3, userId: 1, potentialReturn: 180, odd: { name: 'Mais 2.5', market: { type: 'OVER_UNDER_25' } } },
      ];
      prisma.bet.findMany.mockResolvedValue(pendingBets as any);
      prisma.market.findMany.mockResolvedValue([{ id: 2, type: 'OVER_UNDER_25', fixtureId: 1 }] as any);
      prisma.bet.update.mockResolvedValue({} as any);
      prisma.market.update.mockResolvedValue({} as any);
      prisma.fixture.update.mockResolvedValue({} as any);
      pointsService.creditPoints.mockResolvedValue({} as any);

      const result = await service.settleBets(1);

      expect(result.won).toBe(1);
      expect(pointsService.creditPoints).toHaveBeenCalledWith(
        1, 180, 'BET_WON',
        expect.any(String),
        'bet:3',
      );
    });

    it('should settle BOTH_TEAMS_SCORE correctly', async () => {
      const fixture = { ...mockFixture, status: 'FINISHED', scoreHome: 1, scoreAway: 0, isSettled: false };
      prisma.fixture.findUnique.mockResolvedValue(fixture as any);

      // Only home scored -> BTTS = Nao
      const pendingBets = [
        { ...mockBet, id: 4, userId: 1, potentialReturn: 190, odd: { name: 'Nao', market: { type: 'BOTH_TEAMS_SCORE' } } },
      ];
      prisma.bet.findMany.mockResolvedValue(pendingBets as any);
      prisma.market.findMany.mockResolvedValue([{ id: 3, type: 'BOTH_TEAMS_SCORE', fixtureId: 1 }] as any);
      prisma.bet.update.mockResolvedValue({} as any);
      prisma.market.update.mockResolvedValue({} as any);
      prisma.fixture.update.mockResolvedValue({} as any);
      pointsService.creditPoints.mockResolvedValue({} as any);

      const result = await service.settleBets(1);

      expect(result.won).toBe(1);
    });

    it('should throw if fixture not finished', async () => {
      prisma.fixture.findUnique.mockResolvedValue(mockFixture as any);

      await expect(service.settleBets(1)).rejects.toThrow(BadRequestException);
      await expect(service.settleBets(1)).rejects.toThrow('nao terminou');
    });

    it('should throw if already settled', async () => {
      prisma.fixture.findUnique.mockResolvedValue({
        ...mockFixture, status: 'FINISHED', scoreHome: 1, scoreAway: 0, isSettled: true,
      } as any);

      await expect(service.settleBets(1)).rejects.toThrow(BadRequestException);
      await expect(service.settleBets(1)).rejects.toThrow('ja foram liquidadas');
    });

    it('should mark fixture as settled', async () => {
      const fixture = { ...mockFixture, status: 'FINISHED', scoreHome: 0, scoreAway: 0, isSettled: false };
      prisma.fixture.findUnique.mockResolvedValue(fixture as any);
      prisma.bet.findMany.mockResolvedValue([] as any);
      prisma.market.findMany.mockResolvedValue([] as any);
      prisma.fixture.update.mockResolvedValue({} as any);

      await service.settleBets(1);

      expect(prisma.fixture.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isSettled: true },
      });
    });
  });
});
