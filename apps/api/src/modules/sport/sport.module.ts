import { Module } from '@nestjs/common';
import { SportService } from './sport.service';
import { SportAdminController, SportPublicController } from './sport.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SportService],
  controllers: [SportAdminController, SportPublicController],
  exports: [SportService],
})
export class SportModule {}
