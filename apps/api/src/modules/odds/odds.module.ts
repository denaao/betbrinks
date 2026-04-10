import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OddsService } from './odds.service';
import { OddsController, SyncController } from './odds.controller';
import { OddsGateway } from './odds.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { LeagueModule } from '../league/league.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    PrismaModule,
    RedisModule,
    LeagueModule,
  ],
  providers: [OddsService, OddsGateway],
  controllers: [OddsController, SyncController],
  exports: [OddsService, OddsGateway],
})
export class OddsModule {}
