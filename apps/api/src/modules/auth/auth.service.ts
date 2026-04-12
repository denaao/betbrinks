import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
const DEFAULT_INITIAL_POINTS = 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private jwtService: JwtService,
  ) {}

  // ─── Register ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Validate CPF format and algorithm
    if (!this.validateCPF(dto.cpf)) {
      throw new BadRequestException('CPF invalido. Verifique o formato ou algoritmo de validacao.');
    }

    const formattedCpf = this.formatCPF(dto.cpf);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ cpf: formattedCpf }, { phone: dto.phone }] },
    });

    if (existing) {
      if (existing.cpf === formattedCpf) {
        throw new ConflictException('CPF ja cadastrado');
      }
      throw new ConflictException('Telefone ja cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          cpf: formattedCpf,
          phone: dto.phone,
          passwordHash,
          isVerified: true,
        },
      });

      await tx.pointBalance.create({
        data: { userId: newUser.id, points: DEFAULT_INITIAL_POINTS, diamonds: 0 },
      });

      await tx.pointTransaction.create({
        data: {
          userId: newUser.id,
          type: 'INITIAL_BONUS',
          amount: DEFAULT_INITIAL_POINTS,
          balanceAfter: DEFAULT_INITIAL_POINTS,
          description: `Bonus de boas-vindas: ${DEFAULT_INITIAL_POINTS} pontos`,
        },
      });

      // Auto-enroll in Liga BetBrincadeira
      let ligaOficial = await tx.league.findFirst({
        where: { isOfficial: true },
      });

      if (!ligaOficial) {
        ligaOficial = await tx.league.create({
          data: {
            name: 'Liga BetBrincadeira',
            inviteCode: 'OFICIAL',
            isOfficial: true,
          },
        });
      }

      await tx.leagueMember.create({
        data: {
          leagueId: ligaOficial.id,
          userId: newUser.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      await tx.leagueBalance.create({
        data: {
          leagueId: ligaOficial.id,
          userId: newUser.id,
          balance: 1000,
        },
      });

      return newUser;
    });

    const tokens = await this.generateTokens(user.id, user.cpf || '');

    return {
      message: 'Conta criada com sucesso!',
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  // ─── Verify Phone ──────────────────────────────────────────────────────

  async verifyPhone(dto: VerifyPhoneDto) {
    const storedOtp = await this.redis.get(`otp:${dto.phone}`);

    if (!storedOtp) {
      throw new BadRequestException('Codigo expirado. Solicite um novo.');
    }
    if (storedOtp !== dto.code) {
      throw new BadRequestException('Codigo incorreto.');
    }

    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new BadRequestException('Usuario nao encontrado.');
    if (user.isVerified) throw new BadRequestException('Telefone ja verificado.');

    // Verify + credit initial points + auto-enroll in Liga BetBrincadeira atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });

      await tx.pointBalance.update({
        where: { userId: user.id },
        data: { points: DEFAULT_INITIAL_POINTS },
      });

      await tx.pointTransaction.create({
        data: {
          userId: user.id,
          type: 'INITIAL_BONUS',
          amount: DEFAULT_INITIAL_POINTS,
          balanceAfter: DEFAULT_INITIAL_POINTS,
          description: `Bonus de boas-vindas: ${DEFAULT_INITIAL_POINTS} pontos`,
        },
      });

      // Find or create Liga BetBrincadeira
      let ligaOficial = await tx.league.findFirst({
        where: { isOfficial: true },
      });

      if (!ligaOficial) {
        ligaOficial = await tx.league.create({
          data: {
            name: 'Liga BetBrincadeira',
            inviteCode: 'OFICIAL',
            isOfficial: true,
          },
        });
      }

      // Create LeagueMember
      await tx.leagueMember.create({
        data: {
          leagueId: ligaOficial.id,
          userId: user.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      // Create LeagueBalance with 1000 points
      await tx.leagueBalance.create({
        data: {
          leagueId: ligaOficial.id,
          userId: user.id,
          balance: 1000,
        },
      });
    });

    await this.redis.del(`otp:${dto.phone}`);

    const tokens = await this.generateTokens(user.id, user.cpf || '');

    return {
      message: `Telefone verificado! Voce recebeu ${DEFAULT_INITIAL_POINTS} pontos.`,
      ...tokens,
      user: this.sanitizeUser({ ...user, isVerified: true }),
    };
  }

  // ─── Login ─────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const formattedCpf = this.formatCPF(dto.cpf);

    const user = await this.prisma.user.findUnique({
      where: { cpf: formattedCpf },
    });

    if (!user) throw new UnauthorizedException('CPF ou senha incorretos.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('CPF ou senha incorretos.');

    // Auto-verify on login for dev/testing
    if (!user.isVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Auto-enroll in Liga BetBrincadeira if not already a member
    let ligaOficial = await this.prisma.league.findFirst({
      where: { isOfficial: true },
    });

    if (!ligaOficial) {
      ligaOficial = await this.prisma.league.create({
        data: {
          name: 'Liga BetBrincadeira',
          inviteCode: 'OFICIAL',
          isOfficial: true,
        },
      });
    }

    const existingMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: ligaOficial.id, userId: user.id } },
    });

    if (!existingMember) {
      await this.prisma.leagueMember.create({
        data: {
          leagueId: ligaOficial.id,
          userId: user.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });
      await this.prisma.leagueBalance.upsert({
        where: { leagueId_userId: { leagueId: ligaOficial.id, userId: user.id } },
        create: { leagueId: ligaOficial.id, userId: user.id, balance: 1000 },
        update: {},
      });
    }

    const tokens = await this.generateTokens(user.id, user.cpf || '');

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  // ─── Refresh Token ─────────────────────────────────────────────────────

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const isBlacklisted = await this.redis.exists(`blacklist:${dto.refreshToken}`);
      if (isBlacklisted) throw new UnauthorizedException('Token revogado.');

      // Blacklist old token (7 days TTL)
      await this.redis.set(`blacklist:${dto.refreshToken}`, '1', 7 * 24 * 3600);

      // Support both cpf (new) and email (legacy) from payload
      const identifier = payload.cpf || payload.email;
      return await this.generateTokens(payload.userId, identifier);
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private validateCPF(cpf: string): boolean {
    // Strip formatting
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false; // all same digits

    // Validate check digits (mod 11 algorithm)
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
    let check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    if (parseInt(cleaned[9]) !== check) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
    check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    if (parseInt(cleaned[10]) !== check) return false;

    return true;
  }

  private formatCPF(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '');
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateTokens(userId: number, identifier: string) {
    const payload = { userId, cpf: identifier };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: { id: number; name: string; cpf: string | null; phone: string; avatarUrl: string | null; isVerified: boolean }) {
    return {
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
    };
  }
}
