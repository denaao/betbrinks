import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AffiliateService } from './affiliate.service';

@ApiTags('Afiliados')
@Controller('affiliates')
export class AffiliateController {
  constructor(
    private affiliateService: AffiliateService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── League Admin Endpoints (require user JWT) ─────────────────────────

  @Post('leagues/:leagueId/promote')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Promover membro a afiliado (owner/gestor)' })
  async promoteToAffiliate(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Body() body: { targetUserId: number; revenueSharePct: number; password: string; creditLimit?: number },
  ) {
    return this.affiliateService.promoteToAffiliate(
      userId, leagueId, body.targetUserId, body.revenueSharePct, body.password, body.creditLimit || 0,
    );
  }

  @Post('leagues/:leagueId/sub-affiliate')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar sub-afiliado (afiliado cria sob si)' })
  async createSubAffiliate(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Body() body: { targetUserId: number; revenueSharePct: number; password: string },
  ) {
    return this.affiliateService.createSubAffiliate(
      userId, leagueId, body.targetUserId, body.revenueSharePct, body.password,
    );
  }

  @Get('leagues/:leagueId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar afiliados de uma liga (owner/gestor)' })
  async getLeagueAffiliates(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
  ) {
    return this.affiliateService.getLeagueAffiliates(userId, leagueId);
  }

  @Post('leagues/:leagueId/:affiliateId/update')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar configurações do afiliado (owner/gestor)' })
  async updateAffiliate(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Param('affiliateId', ParseIntPipe) affiliateId: number,
    @Body() body: { revenueSharePct?: number; creditLimit?: number; resetCreditUsed?: boolean },
  ) {
    return this.affiliateService.updateAffiliate(userId, leagueId, affiliateId, body);
  }

  // ─── Referral Registration (player uses affiliate code) ────────────────

  @Post('register-referral')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar indicação via código de afiliado' })
  async registerReferral(
    @CurrentUser('userId') userId: number,
    @Body() body: { affiliateCode: string },
  ) {
    return this.affiliateService.registerReferral(body.affiliateCode, userId);
  }

  // ─── Manual Referral Link (owner/manager links member to affiliate) ────

  @Post('leagues/:leagueId/:affiliateId/link-member')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vincular membro a um afiliado manualmente (owner/gestor)' })
  async linkMemberToAffiliate(
    @CurrentUser('userId') userId: number,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Param('affiliateId', ParseIntPipe) affiliateId: number,
    @Body() body: { targetUserId: number },
  ) {
    return this.affiliateService.linkMemberToAffiliate(userId, leagueId, affiliateId, body.targetUserId);
  }

  // ─── Affiliate Backoffice Endpoints (separate auth) ────────────────────

  @Post('backoffice/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login do afiliado no backoffice (legacy)' })
  async affiliateLogin(
    @Body() body: { affiliateCode: string; password: string },
  ) {
    return this.affiliateService.affiliateLogin(body.affiliateCode, body.password);
  }

  @Get('backoffice/dashboard')
  @Public()
  @ApiOperation({ summary: 'Dashboard do afiliado (requer token de afiliado)' })
  async getDashboard(
    @Headers('authorization') authHeader: string,
    @Param('affiliateId') affiliateIdParam?: string,
  ) {
    const affiliateId = this.extractAffiliateId(authHeader, affiliateIdParam ? parseInt(affiliateIdParam) : undefined);
    return this.affiliateService.getAffiliateDashboard(affiliateId);
  }

  @Get('backoffice/dashboard/:affiliateId')
  @Public()
  @ApiOperation({ summary: 'Dashboard de um afiliado específico (token unificado)' })
  async getDashboardById(
    @Headers('authorization') authHeader: string,
    @Param('affiliateId', ParseIntPipe) affiliateId: number,
  ) {
    this.verifyAffiliateAccess(authHeader, affiliateId);
    return this.affiliateService.getAffiliateDashboard(affiliateId);
  }

  // ─── Affiliate Bets ─────────────────────────────────────────────────

  @Get('backoffice/:affiliateId/bets')
  @Public()
  @ApiOperation({ summary: 'Apostas dos indicados do afiliado' })
  async getAffiliateBets(
    @Headers('authorization') authHeader: string,
    @Param('affiliateId', ParseIntPipe) affiliateId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    this.verifyAffiliateAccess(authHeader, affiliateId);
    return this.affiliateService.getAffiliateBets(
      affiliateId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 25,
      search, status, dateFrom, dateTo,
    );
  }

  // ─── Helper ────────────────────────────────────────────────────────────

  private extractAffiliateId(authHeader: string, requestedId?: number): number {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de afiliado não fornecido.');
    }
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // Unified token (backoffice-login) → has affiliateIds array
      if (payload.affiliateIds && payload.affiliateIds.length > 0) {
        const targetId = requestedId || payload.affiliateIds[0];
        if (!payload.affiliateIds.includes(targetId)) {
          throw new UnauthorizedException('Sem acesso a este perfil de afiliado.');
        }
        return targetId;
      }

      // Legacy affiliate token → has single affiliateId
      if (payload.type === 'affiliate' && payload.affiliateId) {
        return payload.affiliateId;
      }

      throw new UnauthorizedException('Token inválido para afiliado.');
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Token de afiliado inválido ou expirado.');
    }
  }

  private verifyAffiliateAccess(authHeader: string, affiliateId: number): void {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido.');
    }
    const token = authHeader.replace('Bearer ', '');
    const payload = this.jwtService.verify(token, {
      secret: this.config.get<string>('JWT_SECRET'),
    });

    if (payload.affiliateIds && payload.affiliateIds.includes(affiliateId)) return;
    if (payload.type === 'affiliate' && payload.affiliateId === affiliateId) return;
    throw new UnauthorizedException('Sem acesso a este perfil de afiliado.');
  }
}
