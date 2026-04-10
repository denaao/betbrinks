import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PointsService } from './points.service';
import { ConvertDiamondsDto } from './dto/convert-diamonds.dto';

@ApiTags('Points')
@ApiBearerAuth()
@Controller('points')
export class PointsController {
  constructor(private pointsService: PointsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Obter saldo de pontos e diamantes' })
  async getBalance(@CurrentUser('userId') userId: number) {
    return this.pointsService.getBalance(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Historico de transacoes de pontos' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTransactions(
    @CurrentUser('userId') userId: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pointsService.getTransactions(userId, +page, +limit);
  }

  @Post('daily-bonus')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Coletar bonus diario de pontos' })
  async collectDailyBonus(@CurrentUser('userId') userId: number) {
    return this.pointsService.collectDailyBonus(userId);
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Converter diamantes em pontos' })
  async convertDiamonds(
    @CurrentUser('userId') userId: number,
    @Body() dto: ConvertDiamondsDto,
  ) {
    return this.pointsService.convertDiamonds(userId, dto);
  }
}
