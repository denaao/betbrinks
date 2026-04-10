import { Controller, Post, Delete, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post('token')
  @ApiOperation({ summary: 'Register FCM push token for current device' })
  async registerToken(
    @CurrentUser('userId') userId: number,
    @Body() dto: RegisterTokenDto,
  ) {
    return this.notificationService.registerToken(userId, dto);
  }

  @Delete('token')
  @ApiOperation({ summary: 'Remove FCM token (on logout)' })
  async removeToken(@CurrentUser('userId') userId: number) {
    return this.notificationService.removeToken(userId);
  }
}
