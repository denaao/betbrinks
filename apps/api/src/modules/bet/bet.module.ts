import { Module } from '@nestjs/common';
import { BetService } from './bet.service';
import { BetSettlementService } from './bet-settlement.service';
import { BetController } from './bet.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PointsModule } from '../points/points.module';
import { OddsModule } from '../odds/odds.module';

@Module({
  imports: [PrismaModule, RedisModule, PointsModule, OddsModule],
  providers: [BetService, BetSettlementService],
  controllers: [BetController],
  exports: [BetService],
})
export class BetModule {}
