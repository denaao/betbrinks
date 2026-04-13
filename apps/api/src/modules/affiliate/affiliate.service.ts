import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_AFFILIATE_DEPTH = 2; // affiliate + sub-affiliate

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── Promote to Affiliate (Owner/Manager) ────────────────────────────

  async promoteToAffiliate(
    adminId: number,
    leagueId: number,
    targetUserId: number,
    revenueSharePct: number,
    password: string,
    creditLimit: number = 0,
  ) {
    if (revenueSharePct < 0 || revenueSharePct > 100) {
      throw new BadRequestException('Revenue share deve ser entre 0% e 100%.');
    }

    // Verify admin is owner or manager
    const adminMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: adminId } },
    });

    if (!adminMember || (adminMember.role !== 'OWNER' && adminMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Apenas o dono ou gestor pode promover afiliados.');
    }

    // Verify target is a member
    const targetMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) throw new NotFoundException('Membro não encontrado na liga.');

    // Check if already affiliate
    const existing = await this.prisma.leagueAffiliate.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (existing) throw new BadRequestException('Usuário já é afiliado nesta liga.');

    const passwordHash = await bcrypt.hash(password, 12);
    const affiliateCode = this.generateAffiliateCode();

    const affiliate = await this.prisma.leagueAffiliate.create({
      data: {
        leagueId,
        userId: targetUserId,
        parentId: null, // top-level affiliate
        affiliateCode,
        revenueSharePct,
        creditLimit: creditLimit || 0,
        passwordHash,
        isActive: true,
      },
    });

    return {
      id: affiliate.id,
      affiliateCode: affiliate.affiliateCode,
      revenueSharePct: affiliate.revenueSharePct,
    };
  }

  // ─── Create Sub-Affiliate (Affiliate promotes a player under them) ───

  async createSubAffiliate(
    affiliateUserId: number,
    leagueId: number,
    targetUserId: number,
    revenueSharePct: number,
    password: string,
  ) {
    if (revenueSharePct < 0 || revenueSharePct > 100) {
      throw new BadRequestException('Revenue share deve ser entre 0% e 100%.');
    }

    // Get parent affiliate
    const parentAffiliate = await this.prisma.leagueAffiliate.findUnique({
      where: { leagueId_userId: { leagueId, userId: affiliateUserId } },
    });

    if (!parentAffiliate || !parentAffiliate.isActive) {
      throw new ForbiddenException('Você não é afiliado ativo nesta liga.');
    }

    // Check depth: parent must be top-level (parentId === null)
    if (parentAffiliate.parentId !== null) {
      throw new BadRequestException('Sub-afiliados não podem criar outros sub-afiliados. Limite de 2 níveis.');
    }

    // Sub's share can't exceed parent's share
    if (revenueSharePct > parentAffiliate.revenueSharePct) {
      throw new BadRequestException(
        `Revenue share do sub-afiliado (${revenueSharePct}%) não pode exceder a do afiliado pai (${parentAffiliate.revenueSharePct}%).`,
      );
    }

    // Verify target is a member of the league
    const targetMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) throw new NotFoundException('Usuário não é membro da liga.');

    // Check if already affiliate
    const existing = await this.prisma.leagueAffiliate.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (existing) throw new BadRequestException('Usuário já é afiliado nesta liga.');

    const passwordHash = await bcrypt.hash(password, 12);
    const affiliateCode = this.generateAffiliateCode();

    const subAffiliate = await this.prisma.leagueAffiliate.create({
      data: {
        leagueId,
        userId: targetUserId,
        parentId: parentAffiliate.id,
        affiliateCode,
        revenueSharePct,
        passwordHash,
        isActive: true,
      },
    });

    return {
      id: subAffiliate.id,
      affiliateCode: subAffiliate.affiliateCode,
      revenueSharePct: subAffiliate.revenueSharePct,
      parentAffiliateId: parentAffiliate.id,
    };
  }

  // ─── Manual Link Member to Affiliate (owner/manager) ───────────────────

  async linkMemberToAffiliate(
    adminId: number,
    leagueId: number,
    affiliateId: number,
    targetUserId: number,
  ) {
    // Verify caller is owner or manager
    const adminMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: adminId } },
    });

    if (!adminMember || (adminMember.role !== 'OWNER' && adminMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Apenas o dono ou gestor pode vincular indicados.');
    }

    // Verify affiliate exists in this league
    const affiliate = await this.prisma.leagueAffiliate.findUnique({
      where: { id: affiliateId },
    });

    if (!affiliate || affiliate.leagueId !== leagueId) {
      throw new NotFoundException('Afiliado não encontrado nesta liga.');
    }

    // Verify target is a member
    const targetMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Membro não encontrado na liga.');
    }

    // Can't refer the affiliate themselves
    if (affiliate.userId === targetUserId) {
      throw new BadRequestException('Não é possível vincular o afiliado a si mesmo.');
    }

    // Check if already referred by ANY affiliate in this league
    const existingReferral = await this.prisma.affiliateReferral.findFirst({
      where: {
        userId: targetUserId,
        affiliate: { leagueId },
      },
    });

    if (existingReferral) {
      // If already linked to the SAME affiliate, do nothing
      if (existingReferral.affiliateId === affiliate.id) {
        throw new BadRequestException('Este membro já está vinculado a este afiliado.');
      }
      // Otherwise, re-link: delete old and create new
      await this.prisma.affiliateReferral.delete({
        where: { id: existingReferral.id },
      });
    }

    await this.prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        userId: targetUserId,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true },
    });

    return { message: `${user?.name || 'Membro'} vinculado ao afiliado ${affiliate.affiliateCode} com sucesso.` };
  }

  // ─── Register Referral (player joins via affiliate code) ──────────────

  async registerReferral(affiliateCode: string, userId: number) {
    const affiliate = await this.prisma.leagueAffiliate.findUnique({
      where: { affiliateCode },
    });

    if (!affiliate || !affiliate.isActive) {
      throw new NotFoundException('Código de afiliado inválido ou inativo.');
    }

    // Can't refer yourself
    if (affiliate.userId === userId) {
      throw new BadRequestException('Você não pode se auto-indicar.');
    }

    // Check if already referred by this affiliate
    const existing = await this.prisma.affiliateReferral.findUnique({
      where: { affiliateId_userId: { affiliateId: affiliate.id, userId } },
    });

    if (existing) return { message: 'Já registrado como indicação deste afiliado.' };

    // Verify user is member of the league
    const member = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: affiliate.leagueId, userId } },
    });

    if (!member) {
      throw new BadRequestException('Você precisa ser membro da liga para usar este código.');
    }

    await this.prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        userId,
      },
    });

    return { message: 'Indicação registrada com sucesso!' };
  }

  // ─── Calculate Commission (called when bet is lost) ───────────────────

  /**
   * When a player loses a bet, check if they were referred by an affiliate.
   * If so, calculate and record commissions.
   *
   * Commission logic (corrected):
   * - Sub-affiliate gets their own revenueSharePct of the league profit
   * - Parent affiliate gets (parentPct - subPct) of the league profit
   * - Total paid = parentPct (split between parent and sub)
   *
   * Example: parent 30%, sub 10%
   * - League profit = 100 points (player lost 100)
   * - Sub gets 10% of 100 = 10 points
   * - Parent gets (30% - 10%) = 20% of 100 = 20 points
   * - Total commission = 30 points (stays within parent's 30%)
   */
  async processCommission(
    leagueId: number,
    userId: number,
    betSlipId: number | null,
    betAmount: number,
    leagueProfit: number,
  ) {
    // Find if user was referred
    const referral = await this.prisma.affiliateReferral.findFirst({
      where: {
        userId,
        affiliate: { leagueId, isActive: true },
      },
      include: {
        affiliate: {
          include: { parent: true },
        },
      },
    });

    if (!referral) return; // not referred, no commission

    const affiliate = referral.affiliate;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (affiliate.parentId && affiliate.parent) {
          // This affiliate is a sub-affiliate
          // Sub gets their own %
          const subCommission = Math.floor(leagueProfit * affiliate.revenueSharePct / 100);
          if (subCommission > 0) {
            await tx.affiliateCommission.create({
              data: {
                affiliateId: affiliate.id,
                leagueId,
                betSlipId,
                referralUserId: userId,
                betAmount,
                leagueProfit,
                commissionPct: affiliate.revenueSharePct,
                commissionAmt: subCommission,
                level: 1,
              },
            });
          }

          // Parent gets (parentPct - subPct)
          const parentNetPct = affiliate.parent.revenueSharePct - affiliate.revenueSharePct;
          if (parentNetPct > 0) {
            const parentCommission = Math.floor(leagueProfit * parentNetPct / 100);
            if (parentCommission > 0) {
              await tx.affiliateCommission.create({
                data: {
                  affiliateId: affiliate.parent.id,
                  leagueId,
                  betSlipId,
                  referralUserId: userId,
                  betAmount,
                  leagueProfit,
                  commissionPct: parentNetPct,
                  commissionAmt: parentCommission,
                  level: 2,
                },
              });
            }
          }
        } else {
          // Top-level affiliate, gets full %
          const commission = Math.floor(leagueProfit * affiliate.revenueSharePct / 100);
          if (commission > 0) {
            await tx.affiliateCommission.create({
              data: {
                affiliateId: affiliate.id,
                leagueId,
                betSlipId,
                referralUserId: userId,
                betAmount,
                leagueProfit,
                commissionPct: affiliate.revenueSharePct,
                commissionAmt: commission,
                level: 1,
              },
            });
          }
        }
      });
    } catch (e: any) {
      this.logger.error(`Commission processing failed: ${e.message}`);
    }
  }

  // ─── Update Revenue Share (Owner/Manager) ─────────────────────────────

  async updateRevenueShare(
    adminId: number,
    leagueId: number,
    affiliateId: number,
    newPct: number,
  ) {
    return this.updateAffiliate(adminId, leagueId, affiliateId, { revenueSharePct: newPct });
  }

  async updateAffiliate(
    adminId: number,
    leagueId: number,
    affiliateId: number,
    data: { revenueSharePct?: number; creditLimit?: number; resetCreditUsed?: boolean },
  ) {
    const adminMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: adminId } },
    });

    if (!adminMember || (adminMember.role !== 'OWNER' && adminMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Apenas o dono ou gestor pode alterar configurações do afiliado.');
    }

    const affiliate = await this.prisma.leagueAffiliate.findUnique({
      where: { id: affiliateId },
    });

    if (!affiliate || affiliate.leagueId !== leagueId) {
      throw new NotFoundException('Afiliado não encontrado nesta liga.');
    }

    const updateData: any = {};
    if (data.revenueSharePct !== undefined) {
      if (data.revenueSharePct < 0 || data.revenueSharePct > 100) {
        throw new BadRequestException('Revenue share deve ser entre 0% e 100%.');
      }
      updateData.revenueSharePct = data.revenueSharePct;
    }
    if (data.creditLimit !== undefined) {
      updateData.creditLimit = data.creditLimit;
    }
    if (data.resetCreditUsed) {
      updateData.creditUsed = 0;
    }

    await this.prisma.leagueAffiliate.update({
      where: { id: affiliateId },
      data: updateData,
    });

    return { message: 'Afiliado atualizado com sucesso' };
  }

  // ─── Get League Affiliates (Owner/Manager) ────────────────────────────

  async getLeagueAffiliates(adminId: number, leagueId: number) {
    const adminMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: adminId } },
    });

    if (!adminMember || (adminMember.role !== 'OWNER' && adminMember.role !== 'MANAGER')) {
      throw new ForbiddenException('Sem permissão.');
    }

    const affiliates = await this.prisma.leagueAffiliate.findMany({
      where: { leagueId },
      include: {
        user: { select: { id: true, name: true, cpf: true } },
        parent: { include: { user: { select: { name: true } } } },
        children: { include: { user: { select: { id: true, name: true } } } },
        _count: { select: { referrals: true, commissions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return affiliates.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: a.user.name,
      userCpf: a.user.cpf,
      affiliateCode: a.affiliateCode,
      revenueSharePct: a.revenueSharePct,
      isActive: a.isActive,
      parentName: a.parent?.user?.name || null,
      subAffiliates: a.children.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        affiliateCode: c.affiliateCode,
        revenueSharePct: c.revenueSharePct,
      })),
      referralCount: a._count.referrals,
      commissionCount: a._count.commissions,
      createdAt: a.createdAt,
    }));
  }

  // ─── Affiliate Backoffice Login ────────────────────────────────────────

  async affiliateLogin(affiliateCode: string, password: string) {
    const affiliate = await this.prisma.leagueAffiliate.findUnique({
      where: { affiliateCode },
      include: {
        user: { select: { id: true, name: true } },
        league: { select: { id: true, name: true } },
      },
    });

    if (!affiliate) throw new UnauthorizedException('Código ou senha inválidos.');

    const valid = await bcrypt.compare(password, affiliate.passwordHash);
    if (!valid) throw new UnauthorizedException('Código ou senha inválidos.');

    if (!affiliate.isActive) throw new UnauthorizedException('Conta de afiliado desativada.');

    const token = this.jwtService.sign(
      {
        affiliateId: affiliate.id,
        userId: affiliate.userId,
        leagueId: affiliate.leagueId,
        type: 'affiliate',
      },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '24h',
      },
    );

    return {
      token,
      affiliate: {
        id: affiliate.id,
        code: affiliate.affiliateCode,
        revenueSharePct: affiliate.revenueSharePct,
        userName: affiliate.user.name,
        leagueName: affiliate.league.name,
      },
    };
  }

  // ─── Affiliate Dashboard Data ──────────────────────────────────────────

  async getAffiliateDashboard(affiliateId: number) {
    const affiliate = await this.prisma.leagueAffiliate.findUnique({
      where: { id: affiliateId },
      include: {
        user: { select: { name: true } },
        league: { select: { name: true } },
        children: {
          include: {
            user: { select: { id: true, name: true } },
            _count: { select: { referrals: true } },
          },
        },
      },
    });

    if (!affiliate) throw new NotFoundException('Afiliado não encontrado.');

    // Get referrals with their balances
    const referrals = await this.prisma.affiliateReferral.findMany({
      where: { affiliateId },
      include: {
        user: { select: { id: true, name: true, createdAt: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Get commissions summary
    const commissions = await this.prisma.affiliateCommission.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalCommission = commissions.reduce((sum, c) => sum + c.commissionAmt, 0);
    const totalLeagueProfit = commissions.reduce((sum, c) => sum + c.leagueProfit, 0);

    // Monthly breakdown
    const monthlyMap = new Map<string, { commission: number; bets: number }>();
    commissions.forEach((c) => {
      const key = c.createdAt.toISOString().slice(0, 7); // YYYY-MM
      const entry = monthlyMap.get(key) || { commission: 0, bets: 0 };
      entry.commission += c.commissionAmt;
      entry.bets++;
      monthlyMap.set(key, entry);
    });

    return {
      affiliate: {
        id: affiliate.id,
        code: affiliate.affiliateCode,
        revenueSharePct: affiliate.revenueSharePct,
        userName: affiliate.user.name,
        leagueName: affiliate.league.name,
        isActive: affiliate.isActive,
      },
      stats: {
        totalReferrals: referrals.length,
        totalCommission,
        totalLeagueProfit,
        recentCommissions: commissions.slice(0, 20).map((c) => ({
          id: c.id,
          betAmount: c.betAmount,
          leagueProfit: c.leagueProfit,
          commissionPct: c.commissionPct,
          commissionAmt: c.commissionAmt,
          level: c.level,
          createdAt: c.createdAt,
        })),
        monthly: Array.from(monthlyMap.entries()).map(([month, data]) => ({
          month,
          ...data,
        })),
      },
      referrals: referrals.map((r) => ({
        userId: r.user.id,
        userName: r.user.name,
        joinedAt: r.joinedAt,
      })),
      subAffiliates: affiliate.children.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        affiliateCode: c.affiliateCode,
        revenueSharePct: c.revenueSharePct,
        referralCount: c._count.referrals,
      })),
    };
  }

  // ─── Affiliate Bets (bets from referred users) ─────────────────────

  async getAffiliateBets(
    affiliateId: number,
    page = 1,
    limit = 25,
    search?: string,
    status?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = (page - 1) * limit;

    // Get referred user IDs
    const referrals = await this.prisma.affiliateReferral.findMany({
      where: { affiliateId },
      select: { userId: true },
    });
    const referredUserIds = referrals.map((r) => r.userId);

    if (referredUserIds.length === 0) {
      return {
        stats: { totalBets: 0, totalWon: 0, totalLost: 0, totalPending: 0, totalAmount: 0 },
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const where: any = { userId: { in: referredUserIds } };
    if (status && status !== 'ALL') where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: search } },
        ],
      };
    }

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, cpf: true } },
          fixture: {
            select: {
              id: true, homeTeam: true, awayTeam: true,
              scoreHome: true, scoreAway: true, startAt: true, status: true,
              leagueName: true, sportKey: true,
            },
          },
          odd: {
            select: { name: true, value: true, market: { select: { type: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.bet.count({ where }),
    ]);

    // Stats
    const baseWhere = { userId: { in: referredUserIds } };
    const [totalBets, totalWon, totalLost, totalPending, totalAmountAgg] = await Promise.all([
      this.prisma.bet.count({ where: baseWhere }),
      this.prisma.bet.count({ where: { ...baseWhere, status: 'WON' } }),
      this.prisma.bet.count({ where: { ...baseWhere, status: 'LOST' } }),
      this.prisma.bet.count({ where: { ...baseWhere, status: 'PENDING' } }),
      this.prisma.bet.aggregate({ where: baseWhere, _sum: { amount: true } }),
    ]);

    return {
      stats: {
        totalBets,
        totalWon,
        totalLost,
        totalPending,
        totalAmount: totalAmountAgg._sum.amount || 0,
      },
      data: bets.map((b) => ({
        id: b.id,
        user: { id: b.user.id, name: b.user.name, cpf: b.user.cpf },
        fixture: b.fixture,
        odd: { name: b.odd.name, value: parseFloat(b.odd.value.toString()), marketType: b.odd.market.type },
        amount: b.amount,
        oddValue: parseFloat(b.oddValue.toString()),
        potentialReturn: b.potentialReturn,
        status: b.status,
        createdAt: b.createdAt,
        settledAt: b.settledAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private generateAffiliateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'AF';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
