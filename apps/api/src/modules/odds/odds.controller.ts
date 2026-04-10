import { Controller, Get, Post, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OddsService } from './odds.service';

@ApiTags('Odds')
@Controller('odds')
export class OddsController {
  constructor(private oddsService: OddsService) {}

  @Get('fixtures')
  @Public()
  @ApiOperation({ summary: 'Get fixtures for a given date (default: today)' })
  @ApiQuery({ name: 'date', required: false, example: '2026-04-09' })
  @ApiQuery({ name: 'fresh', required: false, example: '1' })
  @ApiQuery({ name: 'sportId', required: false, example: '1' })
  async getFixtures(
    @Query('date') date?: string,
    @Query('fresh') fresh?: string,
    @Query('sportId') sportId?: string,
  ) {
    return this.oddsService.getFixtures(date, fresh === '1', sportId ? parseInt(sportId) : undefined);
  }

  @Get('fixtures/live')
  @Public()
  @ApiOperation({ summary: 'Get live fixtures with real-time scores' })
  async getLiveFixtures() {
    return this.oddsService.getLiveFixtures();
  }

  @Get('fixtures/:id')
  @Public()
  @ApiOperation({ summary: 'Get fixture details with markets and odds' })
  async getFixtureById(@Param('id', ParseIntPipe) id: number) {
    return this.oddsService.getFixtureById(id);
  }

  @Get('leagues')
  @Public()
  @ApiOperation({ summary: 'Get available leagues with upcoming fixtures' })
  async getLeagues() {
    return this.oddsService.getLeagues();
  }
}

// ─── Admin Sync Controller ───────────────────────────────────────────

@ApiTags('Admin Sync')
@ApiBearerAuth()
@Controller('admin/sync')
export class SyncController {
  constructor(private oddsService: OddsService) {}

  @Post('fixtures')
  @ApiOperation({ summary: 'Force sync all fixtures (full sync from API-Football)' })
  async syncFixtures() {
    await this.oddsService.syncFixtures();
    return { message: 'Sync de fixtures completo' };
  }

  @Post('live')
  @ApiOperation({ summary: 'Force update live + should-have-started fixtures' })
  async syncLive() {
    await this.oddsService.syncLiveFixtures();
    return { message: 'Sync de jogos ao vivo completo' };
  }

  @Post('odds')
  @ApiOperation({ summary: 'Force sync odds for upcoming fixtures' })
  async syncOdds() {
    await this.oddsService.syncOdds();
    return { message: 'Sync de odds completo' };
  }

  @Get('diagnostic')
  @Public()
  @ApiOperation({ summary: 'Diagnostic: test API-Football connection and sync status' })
  async diagnostic() {
    return this.oddsService.runDiagnostic();
  }

  @Get('run')
  @Public()
  @ApiOperation({ summary: 'Force full sync (temporary — remove in production)' })
  async forceSync() {
    await this.oddsService.forceSyncAll();
    return { message: 'Sync completo' };
  }
}
