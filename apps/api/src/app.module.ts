import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PointsModule } from './modules/points/points.module';
import { OddsModule } from './modules/odds/odds.module';
import { BetModule } from './modules/bet/bet.module';
import { DiamondModule } from './modules/diamond/diamond.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { NotificationModule } from './modules/notification/notification.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AdminModule } from './modules/admin/admin.module';
import { LeagueModule } from './modules/league/league.module';
import { UserLeagueModule } from './modules/user-league/user-league.module';
import { SportModule } from './modules/sport/sport.module';
import { AffiliateModule } from './modules/affiliate/affiliate.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('15m'),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
        API_FOOTBALL_KEY: Joi.string().required(),
        API_FOOTBALL_BASE_URL: Joi.string().default('https://v3.football.api-sports.io'),
        CORS_ORIGINS: Joi.string().default('http://localhost:3001'),
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },  // 10 req/s
      { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min
      { name: 'long', ttl: 3600000, limit: 1000 }, // 1000 req/h
    ]),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Core modules
    PrismaModule,
    RedisModule,

    // Feature modules
    HealthModule,
    AuthModule,
    UserModule,
    PointsModule,
    OddsModule,
    BetModule,
    DiamondModule,
    RankingModule,
    NotificationModule,
    GamificationModule,
    AdminModule,
    LeagueModule,
    UserLeagueModule,
    SportModule,
    AffiliateModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
