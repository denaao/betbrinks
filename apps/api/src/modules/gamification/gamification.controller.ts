import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private gamificationService: GamificationService) {}

  @Get('achievements')
  @ApiOperation({ summary: 'Get all achievements with unlock status for current user' })
  async getAchievements(@CurrentUser('userId') userId: number) {
    return this.gamificationService.getUserAchievements(userId);
  }

  @Get('level')
  @ApiOperation({ summary: 'Get current level, XP, and progress to next level' })
  async getLevelInfo(@CurrentUser('userId') userId: number) {
    return this.gamificationService.getUserLevelInfo(userId);
  }
}
