import { Module } from '@nestjs/common';
import { UserLeagueService } from './user-league.service';
import { CashboxService } from './cashbox.service';
import { UserLeagueController } from './user-league.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [UserLeagueService, CashboxService],
  controllers: [UserLeagueController],
  exports: [UserLeagueService, CashboxService],
})
export class UserLeagueModule {}
