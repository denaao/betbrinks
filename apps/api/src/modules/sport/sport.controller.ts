import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SportService } from './sport.service';

@ApiTags('Sports / Modalidades (Admin)')
@ApiBearerAuth()
@Controller('admin/sports')
export class SportAdminController {
  constructor(private sportService: SportService) {}

  @Get()
  @ApiOperation({ summary: 'Get all sports with league count' })
  async getAllSports() {
    return this.sportService.getAllSports();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new sport/modality' })
  async createSport(@Body() body: { name: string; icon?: string }) {
    return this.sportService.createSport(body.name, body.icon);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a sport' })
  async updateSport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; icon?: string; sortOrder?: number },
  ) {
    return this.sportService.updateSport(id, body);
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: 'Toggle sport active/inactive' })
  async toggleSport(@Param('id', ParseIntPipe) id: number) {
    return this.sportService.toggleSport(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sport' })
  async deleteSport(@Param('id', ParseIntPipe) id: number) {
    return this.sportService.deleteSport(id);
  }
}

// ─── Public controller (for mobile app) ──────────────────────────────

@ApiTags('Sports / Modalidades')
@Controller('sports')
export class SportPublicController {
  constructor(private sportService: SportService) {}

  @Get()
  @ApiOperation({ summary: 'Get active sports for the app' })
  async getActiveSports() {
    return this.sportService.getActiveSports();
  }
}
