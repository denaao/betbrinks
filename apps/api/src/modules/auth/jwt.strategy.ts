import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Support both user tokens (userId) and admin tokens (adminId)
    if (payload.adminId && payload.email) {
      return {
        adminId: payload.adminId,
        email: payload.email,
        role: payload.role,
        isAdmin: true,
      };
    }

    if (payload.userId && payload.email) {
      return {
        userId: payload.userId,
        email: payload.email,
      };
    }

    throw new UnauthorizedException('Invalid token payload');
  }
}
