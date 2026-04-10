import { Module } from '@nestjs/common';
import { DiamondService } from './diamond.service';
import { DiamondController } from './diamond.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [DiamondService],
  controllers: [DiamondController],
  exports: [DiamondService],
})
export class DiamondModule {}
