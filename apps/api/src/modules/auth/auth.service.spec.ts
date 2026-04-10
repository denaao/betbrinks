import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;
  let config: jest.Mocked<ConfigService>;
  let jwt: jest.Mocked<JwtService>;

  const mockUser = {
    id: 1,
    name: 'Teste',
    email: 'teste@email.com',
    phone: '+5511999999999',
    passwordHash: 'hashed_password',
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
    user: { create: jest.fn(), update: jest.fn() },
    pointBalance: { create: jest.fn(), update: jest.fn() },
    pointTransaction: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(mockPrismaTx)),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                NODE_ENV: 'development',
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_EXPIRATION: '15m',
                JWT_REFRESH_EXPIRATION: '7d',
              };
              return map[key] ?? null;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    config = module.get(ConfigService);
    jwt = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Register ──────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      name: 'Novo Usuario',
      email: 'novo@email.com',
      phone: '+5511988888888',
      password: 'Senha1234',
    };

    it('should register a new user successfully', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrismaTx.user.create.mockResolvedValue({ id: 2, ...dto, passwordHash: 'hashed' });

      const result = await service.register(dto);

      expect(result.message).toContain('Conta criada');
      expect(result.userId).toBe(2);
      expect(result.devOtp).toBeDefined(); // development mode
      expect(redis.set).toHaveBeenCalledWith(
        `otp:${dto.phone}`,
        expect.any(String),
        300,
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...mockUser, email: 'novo@email.com' } as any);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow('Email ja cadastrado');
    });

    it('should throw ConflictException for duplicate phone', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...mockUser, email: 'outro@email.com', phone: dto.phone } as any);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow('Telefone ja cadastrado');
    });

    it('should hash password with bcrypt cost 12', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrismaTx.user.create.mockResolvedValue({ id: 3, ...dto });

      await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
    });

    it('should create point balance with 0 points and 0 diamonds', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockPrismaTx.user.create.mockResolvedValue({ id: 4, ...dto });

      await service.register(dto);

      expect(mockPrismaTx.pointBalance.create).toHaveBeenCalledWith({
        data: { userId: 4, points: 0, diamonds: 0 },
      });
    });
  });

  // ─── Verify Phone ──────────────────────────────────────────────────────

  describe('verifyPhone', () => {
    const dto = { phone: '+5511999999999', code: '123456' };

    it('should verify phone and return tokens', async () => {
      redis.get.mockResolvedValue('123456');
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isVerified: false } as any);

      const result = await service.verifyPhone(dto);

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.isVerified).toBe(true);
      expect(redis.del).toHaveBeenCalledWith(`otp:${dto.phone}`);
    });

    it('should throw if OTP expired', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyPhone(dto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyPhone(dto)).rejects.toThrow('Codigo expirado');
    });

    it('should throw if OTP is wrong', async () => {
      redis.get.mockResolvedValue('654321');

      await expect(service.verifyPhone(dto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyPhone(dto)).rejects.toThrow('Codigo incorreto');
    });

    it('should throw if already verified', async () => {
      redis.get.mockResolvedValue('123456');
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.verifyPhone(dto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyPhone(dto)).rejects.toThrow('ja verificado');
    });

    it('should credit initial points on verification', async () => {
      redis.get.mockResolvedValue('123456');
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isVerified: false } as any);

      await service.verifyPhone(dto);

      expect(mockPrismaTx.pointBalance.update).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { points: 1000 }, // DEFAULT_INITIAL_POINTS
      });
      expect(mockPrismaTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          type: 'INITIAL_BONUS',
          amount: 1000,
        }),
      });
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'teste@email.com', password: 'Senha1234' };

    it('should login and return tokens for verified user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('mock-token');
      expect(result.user.id).toBe(mockUser.id);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for wrong email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should send new OTP if user is not verified', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isVerified: false } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('otp:'),
        expect.any(String),
        300,
      );
    });
  });

  // ─── Refresh Token ─────────────────────────────────────────────────────

  describe('refreshToken', () => {
    const dto = { refreshToken: 'valid-refresh-token' };

    it('should issue new tokens for valid refresh token', async () => {
      jwt.verify.mockReturnValue({ userId: 1, email: 'teste@email.com' } as any);
      redis.exists.mockResolvedValue(false);

      const result = await service.refreshToken(dto);

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(redis.set).toHaveBeenCalledWith(
        `blacklist:${dto.refreshToken}`,
        '1',
        7 * 24 * 3600,
      );
    });

    it('should throw if refresh token is blacklisted', async () => {
      jwt.verify.mockReturnValue({ userId: 1, email: 'teste@email.com' } as any);
      redis.exists.mockResolvedValue(true);

      await expect(service.refreshToken(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if refresh token is invalid', async () => {
      jwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refreshToken(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
