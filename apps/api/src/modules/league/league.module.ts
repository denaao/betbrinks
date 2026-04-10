import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LeagueService } from './league.service';
import { LeagueController } from './league.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, HttpModule, RedisModule],
  providers: [LeagueService],
  controllers: [LeagueController],
  exports: [LeagueService],
})
export class LeagueModule {}
