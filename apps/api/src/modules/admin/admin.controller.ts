import { Controller, Post, Get, Put, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

// Note: In production, create a dedicated AdminGuard checking admin JWT claims.
// For now, admin endpoints use the same JWT auth but require admin role check.

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Auth ──────────────────────────────────────────────────────────────

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Admin login' })
  async login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard/kpis')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard KPIs (users, bets, revenue)' })
  async getDashboardKpis() {
    return this.adminService.getDashboardKpis();
  }

  @Get('dashboard/chart/registrations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registration chart data (last N days)' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  async getRegistrationChart(@Query('days') days?: string) {
    return this.adminService.getRegistrationChart(days ? parseInt(days) : 30);
  }

  @Get('dashboard/chart/bets')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bets chart data (last N days)' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  async getBetChart(@Query('days') days?: string) {
    return this.adminService.getBetChart(days ? parseInt(days) : 30);
  }

  // ─── CRM ───────────────────────────────────────────────────────────────

  @Get('users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users with search and pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
      search,
    );
  }

  @Get('users/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user detail with bets, transactions, achievements' })
  async getUserDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/block')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(@Param('id', ParseIntPipe) id: number) {
    // TODO: Get adminId from JWT
    return this.adminService.blockUser(1, id);
  }

  @Post('users/:id/adjust-points')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust user points (admin action)' })
  async adjustPoints(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount: number; description: string },
  ) {
    return this.adminService.adjustPoints(1, id, body.amount, body.description);
  }

  // ─── Financial ─────────────────────────────────────────────────────────

  @Get('financial')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Financial summary (revenue, purchases)' })
  async getFinancialSummary() {
    return this.adminService.getFinancialSummary();
  }

  // ─── System Config ─────────────────────────────────────────────────────

  @Get('config')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all system configs' })
  async getConfigs() {
    return this.adminService.getConfigs();
  }

  @Put('config')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a system config' })
  async updateConfig(@Body() dto: UpdateConfigDto) {
    return this.adminService.updateConfig(1, dto);
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────

  @Get('audit-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit log with pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  // ─── Fixtures ──────────────────────────────────────────────────────────

  @Get('fixtures')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List fixtures with bet counts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sportKey', required: false })
  @ApiQuery({ name: 'filter', required: false })
  async getFixtures(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sportKey') sportKey?: string,
    @Query('filter') filter?: string,
  ) {
    return this.adminService.getFixtureManagement(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
      sportKey,
      filter,
    );
  }

  // ─── Leagues ───────────────────────────────────────────────────────────

  @Get('private-leagues')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List private leagues with member counts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getPrivateLeagues(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getPrivateLeagues(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
    );
  }
}
