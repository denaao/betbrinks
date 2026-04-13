import { Controller, Post, Get, Put, Param, Body, Query, ParseIntPipe, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { BackofficeLoginDto } from './dto/backoffice-login.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Auth ──────────────────────────────────────────────────────────────

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Admin login (legacy email)' })
  async login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @Post('backoffice-login')
  @Public()
  @ApiOperation({ summary: 'Backoffice login via CPF (admin + afiliado)' })
  async backofficeLogin(
    @Body() dto: BackofficeLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminService.backofficeLogin(dto.cpf, dto.password);

    // VULN-007 fix: Also set token as HttpOnly cookie (more secure than localStorage)
    // The frontend can gradually migrate from Authorization header to cookie-based auth
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('admin_token', result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24h (matches JWT expiration)
      path: '/',
    });

    return result;
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard/kpis')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard KPIs (users, bets, revenue)' })
  async getDashboardKpis() {
    return this.adminService.getDashboardKpis();
  }

  @Get('dashboard/chart/registrations')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registration chart data (last N days)' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  async getRegistrationChart(@Query('days') days?: string) {
    return this.adminService.getRegistrationChart(days ? parseInt(days) : 30);
  }

  @Get('dashboard/chart/bets')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bets chart data (last N days)' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  async getBetChart(@Query('days') days?: string) {
    return this.adminService.getBetChart(days ? parseInt(days) : 30);
  }

  // ─── CRM ───────────────────────────────────────────────────────────────

  @Get('users')
  @Roles('ADMIN')
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
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user detail with bets, transactions, achievements' })
  async getUserDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/block')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const adminId = user.adminId || user.userId;
    return this.adminService.blockUser(adminId, id);
  }

  @Post('users/:id/adjust-points')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adjust user points (admin action)' })
  async adjustPoints(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount: number; description: string },
  ) {
    const adminId = user.adminId || user.userId;
    return this.adminService.adjustPoints(adminId, id, body.amount, body.description);
  }

  // ─── Financial ─────────────────────────────────────────────────────────

  @Get('financial')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Financial summary (revenue, purchases)' })
  async getFinancialSummary() {
    return this.adminService.getFinancialSummary();
  }

  // ─── System Config ─────────────────────────────────────────────────────

  @Get('config')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all system configs' })
  async getConfigs() {
    return this.adminService.getConfigs();
  }

  @Put('config')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a system config' })
  async updateConfig(
    @CurrentUser() user: any,
    @Body() dto: UpdateConfigDto,
  ) {
    const adminId = user.adminId || user.userId;
    return this.adminService.updateConfig(adminId, dto);
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────

  @Get('audit-logs')
  @Roles('ADMIN')
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
  @Roles('ADMIN')
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
  @Roles('ADMIN')
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

  // ─── Bets (Admin: all bets) ─────────────────────────────────────────

  @Get('bets')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all bets with filters (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'sportKey', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getAdminBets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sportKey') sportKey?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getAdminBets(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
      search, status, sportKey, dateFrom, dateTo,
    );
  }

  // ─── Owner Dashboard ──────────────────────────────────────────────────

  @Get('owner/leagues')
  @Roles('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get leagues where user is owner' })
  async getOwnerLeagues(@CurrentUser('userId') userId: number) {
    return this.adminService.getOwnerLeagues(userId);
  }

  @Get('owner/leagues/:leagueId/dashboard')
  @Roles('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner dashboard: cashbox, members, affiliates, transactions' })
  async getOwnerDashboard(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
  ) {
    return this.adminService.getOwnerDashboard(userId, leagueId);
  }

  @Get('owner/leagues/:leagueId/bets')
  @Roles('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner: bets in their league with filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getOwnerBets(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getOwnerBets(
      userId, leagueId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
      search, status, dateFrom, dateTo,
    );
  }

  @Get('owner/leagues/:leagueId/members')
  @Roles('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner CRM: members with search and pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getOwnerMembers(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getOwnerMembers(
      userId,
      leagueId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
      search,
    );
  }

  @Get('owner/leagues/:leagueId/financial')
  @Roles('ADMIN', 'OWNER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner financial: cashbox, transaction history, summaries' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getOwnerFinancial(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getOwnerFinancial(
      userId,
      leagueId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }
}
