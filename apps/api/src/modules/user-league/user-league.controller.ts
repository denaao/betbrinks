import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserLeagueService } from './user-league.service';
import { CashboxService } from './cashbox.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { JoinLeagueDto } from './dto/join-league.dto';
import { TransferBalanceDto } from './dto/transfer-balance.dto';
import { ConvertDiamondsLeagueDto } from './dto/convert-diamonds.dto';

@ApiTags('Ligas')
@ApiBearerAuth()
@Controller('user-leagues')
export class UserLeagueController {
  constructor(
    private userLeagueService: UserLeagueService,
    private cashboxService: CashboxService,
  ) {}

  // ─── Get User's Leagues ────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Obter todas as ligas do usuário (Liga Oficial + privadas)' })
  async getUserLeagues(@CurrentUser('userId') userId: number) {
    return this.userLeagueService.getUserLeagues(userId);
  }

  @Get('star-tiers')
  @ApiOperation({ summary: 'Obter informações dos níveis de estrelas' })
  getStarTiers() {
    return this.userLeagueService.getStarTiers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de uma liga' })
  async getLeagueDetails(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userLeagueService.getLeagueDetails(userId, id);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Obter saldo do usuário em uma liga' })
  async getLeagueBalance(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const balance = await this.userLeagueService.getLeagueBalance(userId, id);
    return { balance };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Obter membros de uma liga (admin/owner only)' })
  async getMembers(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const details = await this.userLeagueService.getLeagueDetails(userId, id);
    return details['members'] || [];
  }

  @Get(':id/requests')
  @ApiOperation({ summary: 'Obter solicitações pendentes de entrada (admin/owner only)' })
  async getJoinRequests(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userLeagueService.getJoinRequests(userId, id);
  }

  @Get(':id/bets')
  @ApiOperation({ summary: 'Obter histórico de apostas do usuário na liga' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLeagueBets(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.userLeagueService.getLeagueBets(userId, id, +page, +limit);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Obter extrato de transações da liga' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLeagueTransactions(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.userLeagueService.getLeagueTransactions(userId, id, +page, +limit);
  }

  // ─── Create / Join ─────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar uma nova liga privada' })
  async createLeague(
    @CurrentUser('userId') userId: number,
    @Body() dto: CreateLeagueDto,
  ) {
    return this.userLeagueService.createLeague(userId, dto);
  }

  @Post('join')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Solicitar entrada em uma liga por código de convite' })
  async requestJoin(
    @CurrentUser('userId') userId: number,
    @Body() dto: JoinLeagueDto,
  ) {
    return this.userLeagueService.requestJoin(userId, dto);
  }

  // ─── League Admin Actions ──────────────────────────────────────────────

  @Post(':id/requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprovar solicitação de entrada na liga' })
  async approveJoinRequest(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    await this.userLeagueService.approveJoinRequest(userId, requestId);
    return { message: 'Solicitação aprovada com sucesso' };
  }

  @Post(':id/requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar solicitação de entrada na liga' })
  async rejectJoinRequest(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    await this.userLeagueService.rejectJoinRequest(userId, requestId);
    return { message: 'Solicitação rejeitada com sucesso' };
  }

  @Post(':id/send-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar saldo para um membro da liga (admin/owner only)' })
  async sendBalance(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferBalanceDto,
  ) {
    await this.userLeagueService.sendBalance(userId, id, dto.targetUserId, dto.amount);
    return { message: `${dto.amount} pontos enviados com sucesso` };
  }

  @Post(':id/withdraw-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sacar saldo de um membro da liga (admin/owner only)' })
  async withdrawBalance(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferBalanceDto,
  ) {
    await this.userLeagueService.withdrawBalance(userId, id, dto.targetUserId, dto.amount);
    return { message: `${dto.amount} pontos sacados com sucesso` };
  }

  @Post(':id/convert-diamonds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Converter diamantes em saldo da liga' })
  async convertDiamonds(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertDiamondsLeagueDto,
  ) {
    await this.userLeagueService.convertDiamondsToBalance(userId, id, dto);
    return { message: `${dto.diamonds} diamantes convertidos com sucesso` };
  }

  // ─── Cashbox (Caixa da Liga) ─────────────────────────────────────────────

  @Get(':id/cashbox')
  @ApiOperation({ summary: 'Ver informações do caixa da liga (membros da liga)' })
  async getCashbox(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // Verify membership
    await this.userLeagueService.getLeagueBalance(userId, id);
    return this.cashboxService.getCashboxInfo(id);
  }

  @Post(':id/cashbox/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Depositar diamantes no caixa da liga (owner only)' })
  async depositToCashbox(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { diamonds: number },
  ) {
    return this.cashboxService.depositToCashbox(userId, id, body.diamonds);
  }

  @Post(':id/cashbox/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sacar do caixa da liga para diamantes (owner only)' })
  async withdrawFromCashbox(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount: number },
  ) {
    return this.cashboxService.withdrawFromCashbox(userId, id, body.amount);
  }

  // ─── Star Upgrade ──────────────────────────────────────────────────────

  @Post(':id/upgrade-stars')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evoluir nível de estrelas da liga (owner only, custa diamantes)' })
  async upgradeStars(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { targetStars: number },
  ) {
    return this.userLeagueService.upgradeLeagueStars(userId, id, body.targetStars);
  }

  // ─── Manager Role ─────────────────────────────────────────────────────

  @Post(':id/members/:memberId/promote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promover membro a gestor (owner only)' })
  async promoteToManager(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() body: { password: string },
  ) {
    await this.userLeagueService.promoteToManager(userId, id, memberId, body.password);
    return { message: 'Membro promovido a gestor com sucesso' };
  }

  @Post(':id/members/:memberId/demote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rebaixar gestor a membro (owner only)' })
  async demoteManager(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() body: { password: string },
  ) {
    await this.userLeagueService.demoteManager(userId, id, memberId, body.password);
    return { message: 'Gestor rebaixado a membro com sucesso' };
  }

  @Post(':id/toggle-auto-approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Habilitar/desabilitar auto-aprovação de membros (owner only)' })
  async toggleAutoApprove(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userLeagueService.toggleAutoApprove(userId, id);
  }

  // ─── Remove Member ─────────────────────────────────────────────────────

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover um membro da liga (admin/owner only)' })
  async removeMember(
    @CurrentUser('userId') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.userLeagueService.removeMember(adminId, id, userId);
    return { message: 'Membro removido com sucesso' };
  }
}
