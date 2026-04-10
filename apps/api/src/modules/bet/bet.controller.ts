import { Controller, Post, Get, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BetService } from './bet.service';
import { CreateBetDto } from './dto/create-bet.dto';
import { CreateBetSlipDto } from './dto/create-bet-slip.dto';

@ApiTags('Bets')
@ApiBearerAuth()
@Controller('bets')
export class BetController {
  constructor(private betService: BetService) {}

  // ─── Bet Slip (Bilhete) ─────────────────────────────────────────────

  @Post('slip')
  @Throttle({ default: { ttl: 5000, limit: 3 } })
  @ApiOperation({ summary: 'Place a new bet slip (single or multiple)' })
  async createBetSlip(
    @CurrentUser('userId') userId: number,
    @Body() dto: CreateBetSlipDto,
  ) {
    return this.betService.createBetSlip(userId, dto);
  }

  @Get('slips/active')
  @ApiOperation({ summary: 'Get all pending bet slips' })
  async getActiveSlips(@CurrentUser('userId') userId: number) {
    return this.betService.getActiveSlips(userId);
  }

  @Get('slips/history')
  @ApiOperation({ summary: 'Get settled bet slip history' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getSlipHistory(
    @CurrentUser('userId') userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.betService.getSlipHistory(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  // ─── Legacy Single Bet ──────────────────────────────────────────────

  @Post()
  @Throttle({ default: { ttl: 5000, limit: 3 } })
  @ApiOperation({ summary: 'Place a single bet (legacy)' })
  async createBet(
    @CurrentUser('userId') userId: number,
    @Body() dto: CreateBetDto,
  ) {
    return this.betService.createBet(userId, dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all pending bets for current user' })
  async getActiveBets(@CurrentUser('userId') userId: number) {
    return this.betService.getActiveBets(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get settled bet history with pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getBetHistory(
    @CurrentUser('userId') userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.betService.getBetHistory(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bet details by ID' })
  async getBetById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.betService.getBetById(id, userId);
  }
}
