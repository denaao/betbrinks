import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DiamondService } from './diamond.service';
import { PurchaseDiamondDto } from './dto/purchase-diamond.dto';

@ApiTags('Diamonds')
@Controller('diamonds')
export class DiamondController {
  constructor(private diamondService: DiamondService) {}

  @Get('packages')
  @Public()
  @ApiOperation({ summary: 'Get available diamond packages with prices' })
  getPackages() {
    return this.diamondService.getPackages();
  }

  @Post('purchase')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase a diamond package (IAP verification)' })
  async purchase(
    @CurrentUser('userId') userId: number,
    @Body() dto: PurchaseDiamondDto,
  ) {
    return this.diamondService.purchase(userId, dto);
  }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase history' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getHistory(
    @CurrentUser('userId') userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.diamondService.getPurchaseHistory(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }
}
