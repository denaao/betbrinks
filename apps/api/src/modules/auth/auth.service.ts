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

  // â”€â”€â”€ Register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async register(dto: RegisterDto) {
    // Validate CPF format and algorithm
    if (!this.validateCPF(dto.cpf)) {
      throw new BadRequestException('CPF invalido. Verifique o formato ou algoritmo de validacao.');
    }

    const formattedCpf = this.formatCPF(dto.cpf);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { cpf: formattedCpf },
          { phone: dto.phone },
          // email duplicate check disabled
        ],
      },
    });

    if (existing) {
      if (existing.cpf === formattedCpf) {
        throw new ConflictException('CPF ja cadastrado');
      }
      if (existing.phone === dto.phone) {
        throw new ConflictException('Telefone ja cadastrado');
      }
      // email check will be added when email field is enabled
      throw new ConflictException('Dados ja cadastrados');
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

  // â”€â”€â”€ Verify Phone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Refresh Token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private validateCPF(cpf: string): boolean {
    // Strip formatting
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Validate first check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cleaned.charAt(9))) return false;

    // Validate second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cleaned.charAt(10))) return false;

    return true;
  }

  private formatCPF(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  private async generateTokens(userId: number, cpf: string) {
    const payload = { userId, cpf };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}