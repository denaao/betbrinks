import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeagueService } from './league.service';

@ApiTags('Leagues (Admin)')
@ApiBearerAuth()
@Controller('admin/leagues')
export class LeagueController {
  constructor(private leagueService: LeagueService) {}

  @Get()
  @ApiOperation({ summary: 'Get all API-Football leagues with enabled status' })
  @ApiQuery({ name: 'sportId', required: false })
  async getAllLeagues(@Query('sportId') sportId?: string) {
    return this.leagueService.getAllApiLeaguesWithStatus(
      sportId ? parseInt(sportId) : undefined,
    );
  }

  @Get('enabled')
  @ApiOperation({ summary: 'Get only enabled leagues from our DB' })
  async getEnabledLeagues() {
    return this.leagueService.getAllLeagues();
  }

  @Post('enable')
  @ApiOperation({ summary: 'Enable a league (show in app)' })
  async enableLeague(
    @Body() body: { apiFootballId: number; name: string; country: string; logo?: string; sportId?: number },
  ) {
    return this.leagueService.enableLeague(
      body.apiFootballId, body.name, body.country, body.logo, body.sportId,
    );
  }

  @Post('disable')
  @ApiOperation({ summary: 'Disable a league (hide from app)' })
  async disableLeague(@Body() body: { apiFootballId: number }) {
    return this.leagueService.disableLeague(body.apiFootballId);
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: 'Toggle league active/inactive by DB id' })
  async toggleLeague(@Param('id', ParseIntPipe) id: number) {
    return this.leagueService.toggleLeague(id);
  }

  @Put('sport')
  @ApiOperation({ summary: 'Update league sport/modality' })
  async updateLeagueSport(
    @Body() body: { apiFootballId: number; sportId: number | null },
  ) {
    return this.leagueService.updateLeagueSport(body.apiFootballId, body.sportId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a league' })
  async removeLeague(@Param('id', ParseIntPipe) id: number) {
    return this.leagueService.removeLeague(id);
  }
}
