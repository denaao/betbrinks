import { Module } from '@nestjs/common';
import { UserLeagueService } from './user-league.service';
import { UserLeagueController } from './user-league.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [UserLeagueService],
  controllers: [UserLeagueController],
  exports: [UserLeagueService],
})
export class UserLeagueModule {}
