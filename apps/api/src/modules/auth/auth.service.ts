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
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email.toLowerCase().trim() }, { phone: dto.phone }] },
    });

    if (existing) {
      if (existing.email === dto.email.toLowerCase().trim()) {
        throw new ConflictException('Email ja cadastrado');
      }
      throw new ConflictException('Telefone ja cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone,
          passwordHash,
        },
      });

      await tx.pointBalance.create({
        data: { userId: newUser.id, points: 0, diamonds: 0 },
      });

      return newUser;
    });

    // Generate and store OTP (5 min TTL)
    const otp = this.generateOTP();
    await this.redis.set(`otp:${dto.phone}`, otp, 300);

    // TODO: Send SMS via Twilio — for now, log in dev
    console.log(`[OTP] ${dto.phone}: ${otp}`);

    return {
      message: 'Conta criada! Verifique seu telefone com o codigo SMS.',
      userId: user.id,
      ...(this.config.get('NODE_ENV') === 'development' ? { devOtp: otp } : {}),
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

    // Verify + credit initial points atomically
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
    });

    await this.redis.del(`otp:${dto.phone}`);

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      message: `Telefone verificado! Voce recebeu ${DEFAULT_INITIAL_POINTS} pontos.`,
      ...tokens,
      user: this.sanitizeUser({ ...user, isVerified: true }),
    };
  }

  // ─── Login ─────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) throw new UnauthorizedException('Email ou senha incorretos.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou senha incorretos.');

    if (!user.isVerified) {
      const otp = this.generateOTP();
      await this.redis.set(`otp:${user.phone}`, otp, 300);
      console.log(`[OTP] ${user.phone}: ${otp}`);
      throw new UnauthorizedException('Telefone nao verificado. Novo codigo SMS enviado.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email);

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

      return await this.generateTokens(payload.userId, payload.email);
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateTokens(userId: number, email: string) {
    const payload = { userId, email };
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

  private sanitizeUser(user: { id: number; name: string; email: string; phone: string; avatarUrl: string | null; isVerified: boolean }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
    };
  }
}
