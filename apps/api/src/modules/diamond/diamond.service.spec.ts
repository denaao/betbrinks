import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DiamondService } from './diamond.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('DiamondService', () => {
  let service: DiamondService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;

  const mockPrismaTx = {
    diamondPurchase: { update: jest.fn() },
    pointBalance: { update: jest.fn() },
  };

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiamondService,
        {
          provide: PrismaService,
          useValue: {
            diamondPurchase: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            pointBalance: { update: jest.fn() },
            $transaction: jest.fn((cb) => cb(mockPrismaTx)),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            getJson: jest.fn(),
            setJson: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiamondService>(DiamondService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getPackages', () => {
    it('should return all 4 packages with formatted prices', () => {
      const packages = service.getPackages();
      expect(packages).toHaveLength(4);
      expect(packages[0].id).toBe('starter');
      expect(packages[0].diamonds).toBe(100);
      expect(packages[0].priceFormatted).toContain('R$');
      expect(packages[3].id).toBe('vip');
      expect(packages[3].diamonds).toBe(3000);
    });
  });

  describe('purchase', () => {
    const dto = { packageId: 'starter', platform: 'google_play', storeReceipt: 'TEST_123' };

    it('should create purchase and credit diamonds in dev mode', async () => {
      prisma.diamondPurchase.findFirst.mockResolvedValue(null);
      prisma.diamondPurchase.create.mockResolvedValue({
        id: 1, userId: 1, packageId: 'starter', diamonds: 100,
        priceBrl: 4.90, platform: 'google_play', storeReceipt: 'TEST_123',
        status: 'PENDING', createdAt: new Date(),
      } as any);

      const result = await service.purchase(1, dto);

      expect(result.status).toBe('VERIFIED');
      expect(result.diamonds).toBe(100);
      expect(mockPrismaTx.diamondPurchase.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'VERIFIED' },
      });
      expect(mockPrismaTx.pointBalance.update).toHaveBeenCalledWith({
        where: { userId: 1 },
        data: { diamonds: { increment: 100 } },
      });
    });

    it('should throw for invalid package', async () => {
      await expect(
        service.purchase(1, { ...dto, packageId: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for duplicate receipt', async () => {
      prisma.diamondPurchase.findFirst.mockResolvedValue({ id: 99 } as any);

      await expect(service.purchase(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.purchase(1, dto)).rejects.toThrow('Recibo ja utilizado');
    });
  });

  describe('getPurchaseHistory', () => {
    it('should return paginated purchase history', async () => {
      prisma.diamondPurchase.findMany.mockResolvedValue([
        { id: 1, packageId: 'starter', diamonds: 100, priceBrl: 4.90, platform: 'google_play', status: 'VERIFIED', createdAt: new Date() },
      ] as any);
      prisma.diamondPurchase.count.mockResolvedValue(1);

      const result = await service.getPurchaseHistory(1, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].diamonds).toBe(100);
    });
  });
});
