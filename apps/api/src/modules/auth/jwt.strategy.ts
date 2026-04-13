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
      // VULN-007: Accept JWT from both Authorization header AND HttpOnly cookie
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.cookies?.admin_token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Support admin tokens (adminId + email)
    if (payload.adminId && payload.email) {
      return {
        adminId: payload.adminId,
        email: payload.email,
        role: payload.role,
        isAdmin: true,
      };
    }

    // Support user tokens (userId + cpf/email), including unified backoffice token
    if (payload.userId && (payload.cpf || payload.email)) {
      return {
        userId: payload.userId,
        cpf: payload.cpf,
        email: payload.email,
        role: payload.role,
        type: payload.type,
        affiliateIds: payload.affiliateIds || [],
      };
    }

    throw new UnauthorizedException('Invalid token payload');
  }
}
