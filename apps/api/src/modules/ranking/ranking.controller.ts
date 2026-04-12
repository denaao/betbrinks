import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RankingService } from './ranking.service';

@ApiTags('Ranking')
@ApiBearerAuth()
@Controller('ranking')
export class RankingController {
  constructor(private rankingService: RankingService) {}

  @Get('global')
  @ApiOperation({ summary: 'Global ranking by total points' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getGlobalRanking(@Query('limit') limit?: string) {
    return this.rankingService.getGlobalRanking(limit ? parseInt(limit) : 50);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Weekly ranking by bets won' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getWeeklyRanking(@Query('limit') limit?: string) {
    return this.rankingService.getWeeklyRanking(limit ? parseInt(limit) : 50);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Monthly ranking by bets won' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getMonthlyRanking(@Query('limit') limit?: string) {
    return this.rankingService.getMonthlyRanking(limit ? parseInt(limit) : 50);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user position and stats' })
  async getMyPosition(@CurrentUser('userId') userId: number) {
    return this.rankingService.getUserPosition(userId);
  }

  @Get('league/:leagueId')
  @ApiOperation({ summary: 'Ranking by league' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getLeagueRanking(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('limit') limit?: string,
  ) {
    return this.rankingService.getLeagueRanking(leagueId, limit ? parseInt(limit) : 50);
  }
}
