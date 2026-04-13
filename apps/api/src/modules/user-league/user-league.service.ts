import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { JoinLeagueDto } from './dto/join-league.dto';
import { TransferBalanceDto } from './dto/transfer-balance.dto';
import { ConvertDiamondsLeagueDto } from './dto/convert-diamonds.dto';
import * as bcrypt from 'bcryptjs';

const DIAMOND_CONVERSION_RATE = 5; // 1 diamond = 5 points
const MAX_INVITE_CODE_RETRIES = 10;

// Valid league transaction types (application-level enum, DB field remains VarChar for safety)
export const LEAGUE_TX_TYPES = [
  'BET_PLACED',
  'BET_WON',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
  'DEPOSIT',
  'WITHDRAWAL',
  'DIAMOND_CONVERSION',
  'STAR_UPGRADE',
  'TRANSFER',
] as const;
export type LeagueTransactionType = (typeof LEAGUE_TX_TYPES)[number];

// Star tier configuration
const STAR_TIERS: Record<number, { maxMembers: number; maxManagers: number }> = {
  0: { maxMembers: 15, maxManagers: 0 },
  1: { maxMembers: 100, maxManagers: 1 },
  2: { maxMembers: 250, maxManagers: 2 },
  3: { maxMembers: 600, maxManagers: 3 },
  4: { maxMembers: 1000, maxManagers: 4 },
  5: { maxMembers: 1500, maxManagers: 5 },
};

const STAR_COSTS: Record<number, number> = {
  0: 0,
  1: 50,
  2: 125,
  3: 300,
  4: 500,
  5: 750,
};

function getStarUpgradeCost(targetStars: number): number {
  return STAR_COSTS[targetStars] ?? 0;
}

const STAR_DURATION_DAYS = 30;
const STAR_EXPIRY_WARNING_DAYS = 3;

@Injectable()
export class UserLeagueService {
  private readonly logger = new Logger(UserLeagueService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Liga BetBrincadeira ──────────────────────────────────────────────────────

  /**
   * Find or create the Liga BetBrincadeira (singleton)
   */
  async getOrCreateLigaOficial() {
    const cacheKey = 'liga_oficial:id';
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const found = await this.prisma.league.findUnique({ where: { id: parseInt(cached) } });
      if (found) return found;
    }

    let ligaOficial = await this.prisma.league.findFirst({
      where: { isOfficial: true },
    });

    if (!ligaOficial) {
      ligaOficial = await this.prisma.league.create({
        data: {
          name: 'Liga BetBrincadeira',
          inviteCode: 'OFICIAL',
          isOfficial: true,
          ownerId: null,
        },
      });
      this.logger.log(`Created Liga BetBrincadeira with ID ${ligaOficial.id}`);
    } else if (ligaOficial.name !== 'Liga BetBrincadeira') {
      ligaOficial = await this.prisma.league.update({
        where: { id: ligaOficial.id },
        data: { name: 'Liga BetBrincadeira' },
      });
    }

    // Cache for 24 hours
    await this.redis.set(cacheKey, ligaOficial.id.toString(), 86400);

    return ligaOficial;
  }

  // ─── User's Leagues ────────────────────────────────────────────────────

  /**
   * Get all leagues user belongs to (Liga BetBrincadeira first, then private by name)
   */
  async getUserLeagues(userId: number) {
    // Get Liga BetBrincadeira first
    const ligaOficial = await this.getOrCreateLigaOficial();

    // Get user's memberships
    const memberships = await this.prisma.leagueMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        league: true,
      },
      orderBy: {
        league: {
          name: 'asc',
        },
      },
    });

    // Get balances
    const balances = await this.prisma.leagueBalance.findMany({
      where: { userId },
    });

    const balanceMap = new Map(balances.map((b) => [b.leagueId, b.balance]));

    // Get member counts
    const memberCounts = await Promise.all(
      memberships.map((m) =>
        this.prisma.leagueMember.count({
          where: { leagueId: m.leagueId, status: 'ACTIVE' },
        }),
      ),
    );

    // Check if user is in Liga BetBrincadeira — auto-enroll if not
    let isInLigaOficial = ligaOficial ? memberships.some((m) => m.leagueId === ligaOficial.id) : false;

    if (!isInLigaOficial && ligaOficial) {
      // Auto-enroll user in Liga BetBrincadeira (covers users created before this logic)
      await this.prisma.leagueMember.create({
        data: {
          leagueId: ligaOficial.id,
          userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });
      await this.prisma.leagueBalance.upsert({
        where: { leagueId_userId: { leagueId: ligaOficial.id, userId } },
        create: { leagueId: ligaOficial.id, userId, balance: 1000 },
        update: {},
      });
      isInLigaOficial = true;
      this.logger.log(`Auto-enrolled user ${userId} in Liga BetBrincadeira`);
    }

    const result: any[] = [];

    // Add Liga BetBrincadeira first
    if (isInLigaOficial && ligaOficial) {
      const memberIndex = memberships.findIndex((m) => m.leagueId === ligaOficial.id);
      const oficialMemberCount = await this.prisma.leagueMember.count({
        where: { leagueId: ligaOficial.id, status: 'ACTIVE' },
      });
      result.push({
        id: ligaOficial.id,
        name: ligaOficial.name,
        inviteCode: ligaOficial.inviteCode,
        isOfficial: true,
        role: memberIndex >= 0 ? memberships[memberIndex].role : 'MEMBER',
        balance: balanceMap.get(ligaOficial.id) || 1000,
        memberCount: oficialMemberCount,
      });
    }

    // Add private leagues
    memberships.forEach((m, index) => {
      if (!m.league.isOfficial) {
        // Check star expiry: if expired, effective stars = 1
        const now = new Date();
        let effectiveStars = m.league.stars;
        const expired = m.league.starsExpiresAt && m.league.starsExpiresAt < now;
        if (expired && effectiveStars > 0) effectiveStars = 0;

        const tier = STAR_TIERS[effectiveStars] || STAR_TIERS[0];
        const expiresAt = m.league.starsExpiresAt;
        const daysUntilExpiry = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

        result.push({
          id: m.league.id,
          name: m.league.name,
          inviteCode: m.league.inviteCode,
          isOfficial: false,
          role: m.role,
          balance: balanceMap.get(m.leagueId) || 0,
          memberCount: memberCounts[index],
          cashbox: m.league.cashbox,
          autoApprove: m.league.autoApprove,
          isOpen: m.league.isOpen,
          stars: effectiveStars,
          starsExpiresAt: expiresAt,
          starsExpired: !!expired,
          starsExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= STAR_EXPIRY_WARNING_DAYS && daysUntilExpiry > 0,
          daysUntilExpiry,
          maxMembers: tier.maxMembers,
          maxManagers: tier.maxManagers,
          overLimit: memberCounts[index] > tier.maxMembers,
        });
      }
    });

    return result;
  }

  /**
   * Get league details (with members if user is owner/admin)
   */
  async getLeagueDetails(userId: number, leagueId: number) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) throw new NotFoundException('Liga não encontrada');

    // Verify user is a member
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) throw new ForbiddenException('Você não é membro desta liga');

    const memberCount = await this.prisma.leagueMember.count({
      where: { leagueId, status: 'ACTIVE' },
    });

    const balance = await this.prisma.leagueBalance.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    // Check star expiry
    const now = new Date();
    let effectiveStars = league.stars;
    const expired = league.starsExpiresAt && league.starsExpiresAt < now;
    if (expired && effectiveStars > 0) effectiveStars = 0;
    const tier = STAR_TIERS[effectiveStars] || STAR_TIERS[0];
    const daysUntilExpiry = league.starsExpiresAt
      ? Math.ceil((league.starsExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const result: any = {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      isOfficial: league.isOfficial,
      role: membership.role,
      memberCount,
      balance: balance?.balance || 0,
      cashbox: league.cashbox,
      cashboxInitial: league.cashboxInitial,
      cashboxMinAlert: league.cashboxMinAlert,
      isOpen: league.isOpen,
      cashboxHealth: league.cashboxInitial > 0
        ? Math.round((league.cashbox / league.cashboxInitial) * 100)
        : 0,
      createdAt: league.createdAt,
      stars: effectiveStars,
      starsExpiresAt: league.starsExpiresAt,
      starsExpired: !!expired,
      starsExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= STAR_EXPIRY_WARNING_DAYS && daysUntilExpiry > 0,
      daysUntilExpiry,
      maxMembers: tier.maxMembers,
      maxManagers: tier.maxManagers,
      overLimit: memberCount > tier.maxMembers,
    };

    // Include members if user is owner, admin, or manager
    if (membership.role === 'OWNER' || membership.role === 'ADMIN' || membership.role === 'MANAGER') {
      const members = await this.prisma.leagueMember.findMany({
        where: { leagueId, status: 'ACTIVE' },
        include: {
          user: {
            select: { id: true, name: true, cpf: true, avatarUrl: true },
          },
        },
      });

      const memberBalances = await this.prisma.leagueBalance.findMany({
        where: { leagueId },
      });
      const balMap = new Map(memberBalances.map((b) => [b.userId, b.balance]));

      // Get affiliates for this league
      const affiliates = await this.prisma.leagueAffiliate.findMany({
        where: { leagueId },
        include: { user: { select: { name: true } } },
      });
      const affMap = new Map(affiliates.map((a) => [a.userId, a]));
      const affIdMap = new Map(affiliates.map((a) => [a.id, a]));

      // Get referrals for this league (who is linked to which affiliate)
      const referrals = await this.prisma.affiliateReferral.findMany({
        where: { affiliate: { leagueId } },
      });
      const refMap = new Map(referrals.map((r) => [r.userId, r.affiliateId]));

      result.members = members.map((m: any) => {
        const aff = affMap.get(m.userId);
        const linkedAffId = refMap.get(m.userId);
        const linkedAff = linkedAffId ? affIdMap.get(linkedAffId) : null;
        return {
          userId: m.userId,
          name: m.user.name,
          cpf: m.user.cpf,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          balance: balMap.get(m.userId) || 0,
          joinedAt: m.joinedAt,
          isAffiliate: !!aff,
          affiliateCode: aff?.affiliateCode || null,
          revenueSharePct: aff?.revenueSharePct || null,
          creditLimit: aff?.creditLimit || 0,
          creditUsed: aff?.creditUsed || 0,
          linkedToAffiliateId: linkedAffId || null,
          linkedToAffiliateName: linkedAff ? (linkedAff as any).user?.name || null : null,
          linkedToAffiliateCode: linkedAff?.affiliateCode || null,
        };
      });
    }

    return result;
  }

  /**
   * Get user's balance in a specific league
   */
  async getLeagueBalance(userId: number, leagueId: number): Promise<number> {
    // Verify user is a member
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) throw new ForbiddenException('Você não é membro desta liga');

    const balance = await this.prisma.leagueBalance.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    return balance?.balance || 0;
  }

  // ─── Create / Join ────────────────────────────────────────────────────

  /**
   * Create a private league
   */
  async createLeague(userId: number, dto: CreateLeagueDto) {
    const initialDiamonds = dto.initialDiamonds;
    const initialPoints = initialDiamonds * DIAMOND_CONVERSION_RATE;
    const minAlert = dto.cashboxMinAlert ?? 100;

    // Check user has enough diamonds for initial cashbox
    const userBalance = await this.prisma.pointBalance.findUnique({ where: { userId } });
    if (!userBalance || userBalance.diamonds < initialDiamonds) {
      throw new BadRequestException(
        `Diamantes insuficientes. Você tem ${userBalance?.diamonds || 0}, precisa de ${initialDiamonds} para abrir a liga.`,
      );
    }

    // Generate unique invite code
    let inviteCode: string;
    let isUnique = false;
    let retries = 0;

    while (!isUnique && retries < MAX_INVITE_CODE_RETRIES) {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.league.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        isUnique = true;
      }
      retries++;
    }

    if (!isUnique) {
      throw new BadRequestException('Não foi possível gerar código de convite único');
    }

    // Create league, member, balance, deduct diamonds, and fund cashbox atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const league = await tx.league.create({
        data: {
          name: dto.name,
          inviteCode,
          isOfficial: false,
          ownerId: userId,
          cashbox: initialPoints,
          cashboxInitial: initialPoints,
          cashboxMinAlert: minAlert,
          isOpen: true,
        },
      });

      await tx.leagueMember.create({
        data: {
          leagueId: league.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      await tx.leagueBalance.create({
        data: {
          leagueId: league.id,
          userId,
          balance: 0,
        },
      });

      // Deduct diamonds from owner
      await tx.pointBalance.update({
        where: { userId },
        data: { diamonds: { decrement: initialDiamonds } },
      });

      // Log cashbox deposit
      await tx.cashboxLog.create({
        data: {
          leagueId: league.id,
          type: 'DEPOSIT',
          amount: initialPoints,
          balanceAfter: initialPoints,
          description: `Depósito inicial: ${initialDiamonds} diamantes → ${initialPoints} fichas`,
        },
      });

      return league;
    });

    return {
      ...result,
      cashbox: initialPoints,
      cashboxInitial: initialPoints,
    };
  }

  /**
   * Request to join a league by invite code
   */
  async requestJoin(userId: number, dto: JoinLeagueDto) {
    const league = await this.prisma.league.findUnique({
      where: { inviteCode: dto.inviteCode.toUpperCase() },
    });

    if (!league) throw new NotFoundException('Código de convite inválido');

    // Check user is not already a member
    const existingMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId } },
    });

    if (existingMember) {
      throw new BadRequestException('Você já é membro desta liga');
    }

    // Check no pending request exists
    const existingRequest = await this.prisma.leagueJoinRequest.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId } },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new BadRequestException('Você já tem uma solicitação pendente nesta liga');
      }
      // If rejected, allow a new request
      if (existingRequest.status === 'REJECTED') {
        await this.prisma.leagueJoinRequest.delete({
          where: { id: existingRequest.id },
        });
      }
    }

    // If auto-approve is enabled, add member directly
    if (league.autoApprove) {
      await this.checkLeagueCapacity(league.id);

      const member = await this.prisma.$transaction(async (tx) => {
        const m = await tx.leagueMember.create({
          data: { leagueId: league.id, userId, role: 'MEMBER' },
        });
        await tx.leagueBalance.create({
          data: { leagueId: league.id, userId, balance: 0 },
        });
        return m;
      });

      return { ...member, autoApproved: true };
    }

    const request = await this.prisma.leagueJoinRequest.create({
      data: {
        leagueId: league.id,
        userId,
        status: 'PENDING',
      },
    });

    return request;
  }

  // ─── League Admin (Owner) ──────────────────────────────────────────────

  /**
   * Get pending join requests for a league (only owner/admin)
   */
  async getJoinRequests(userId: number, leagueId: number) {
    await this.verifyLeagueAdmin(userId, leagueId);

    const requests = await this.prisma.leagueJoinRequest.findMany({
      where: {
        leagueId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { requestedAt: 'asc' },
    });

    return requests.map((r) => ({
      id: r.id,
      userId: r.user.id,
      userName: r.user.name,
      userAvatar: r.user.avatarUrl,
      requestedAt: r.requestedAt,
    }));
  }

  /**
   * Approve join request
   */
  async approveJoinRequest(userId: number, requestId: number) {
    const request = await this.prisma.leagueJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Solicitação não encontrada');

    // Verify user is admin of the league
    await this.verifyLeagueAdmin(userId, request.leagueId);

    // Check member limit before approving
    const league = await this.prisma.league.findUnique({ where: { id: request.leagueId } });
    if (league && !league.isOfficial) {
      const now = new Date();
      let effectiveStars = league.stars;
      if (league.starsExpiresAt && league.starsExpiresAt < now && effectiveStars > 0) effectiveStars = 0;
      const tier = STAR_TIERS[effectiveStars] || STAR_TIERS[0];
      const currentMembers = await this.prisma.leagueMember.count({
        where: { leagueId: league.id, status: 'ACTIVE' },
      });
      if (currentMembers >= tier.maxMembers) {
        throw new BadRequestException(
          `Liga atingiu o limite de ${tier.maxMembers} membros para nível ${effectiveStars}⭐. O dono precisa evoluir a liga.`,
        );
      }
    }

    // Approve atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.leagueJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          decidedAt: new Date(),
        },
      });

      await tx.leagueMember.create({
        data: {
          leagueId: request.leagueId,
          userId: request.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      await tx.leagueBalance.create({
        data: {
          leagueId: request.leagueId,
          userId: request.userId,
          balance: 0,
        },
      });
    });
  }

  /**
   * Reject join request
   */
  async rejectJoinRequest(userId: number, requestId: number) {
    const request = await this.prisma.leagueJoinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Solicitação não encontrada');

    // Verify user is admin of the league
    await this.verifyLeagueAdmin(userId, request.leagueId);

    await this.prisma.leagueJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedAt: new Date(),
      },
    });
  }

  /**
   * Remove member from league
   */
  async removeMember(adminId: number, leagueId: number, targetUserId: number) {
    const adminMembership = await this.verifyLeagueAdmin(adminId, leagueId);

    if (adminId === targetUserId) {
      throw new BadRequestException('Você não pode se remover da liga');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!membership) {
      throw new NotFoundException('Membro não encontrado');
    }

    // Managers cannot remove other managers or owners
    if (adminMembership.role === 'MANAGER') {
      if (membership.role === 'MANAGER' || membership.role === 'OWNER' || membership.role === 'ADMIN') {
        throw new ForbiddenException('Gestores não podem remover outros gestores ou o dono.');
      }
    }

    await this.prisma.leagueMember.update({
      where: { id: membership.id },
      data: { status: 'LEFT' },
    });
  }

  /**
   * Send balance to a member (owner/admin only)
   */
  async sendBalance(
    adminId: number,
    leagueId: number,
    targetUserId: number,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que 0');
    }

    await this.verifyLeagueAdmin(adminId, leagueId);
    await this.checkLeagueCapacity(leagueId);

    // Check affiliate credit limit (non-owners only)
    const adminMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: adminId } },
    });
    if (adminMember && adminMember.role !== 'OWNER') {
      const affiliate = await this.prisma.leagueAffiliate.findUnique({
        where: { leagueId_userId: { leagueId, userId: adminId } },
      });
      if (affiliate && affiliate.creditLimit > 0) {
        const remaining = affiliate.creditLimit - affiliate.creditUsed;
        if (amount > remaining) {
          throw new BadRequestException(
            `Limite de crédito excedido. Disponível: ${remaining} fichas (limite: ${affiliate.creditLimit}, usado: ${affiliate.creditUsed}).`,
          );
        }
      }
    }

    // Verify target is a member
    const targetMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Membro não encontrado');
    }

    // Verify league has enough cashbox
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Liga não encontrada.');
    if (league.cashbox < amount) {
      throw new BadRequestException(
        `Caixa da liga insuficiente. Caixa: ${league.cashbox}, necessário: ${amount}.`,
      );
    }

    // Deduct from cashbox, credit member balance atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.league.update({
        where: { id: leagueId },
        data: { cashbox: { decrement: amount } },
      });

      await tx.leagueBalance.update({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        data: { balance: { increment: amount } },
      });

      await tx.leagueTransaction.create({
        data: {
          leagueId,
          fromUserId: adminId,
          toUserId: targetUserId,
          amount,
          type: 'ADMIN_CREDIT',
          description: `Crédito do administrador: +${amount} pontos (caixa → membro)`,
        },
      });

      await tx.cashboxLog.create({
        data: {
          leagueId,
          type: 'WITHDRAWAL',
          amount: -amount,
          balanceAfter: league.cashbox - amount,
          description: `Envio de ${amount} fichas para membro`,
        },
      });

      // Update affiliate credit usage if applicable
      if (adminMember && adminMember.role !== 'OWNER') {
        await tx.leagueAffiliate.updateMany({
          where: { leagueId, userId: adminId },
          data: { creditUsed: { increment: amount } },
        });
      }
    });
  }

  /**
   * Withdraw balance from a member (owner/admin only)
   */
  async withdrawBalance(
    adminId: number,
    leagueId: number,
    targetUserId: number,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que 0');
    }

    await this.verifyLeagueAdmin(adminId, leagueId);
    await this.checkLeagueCapacity(leagueId);

    // Verify target is a member
    const targetMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Membro não encontrado');
    }

    // Check target has sufficient balance
    const balance = await this.prisma.leagueBalance.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!balance || balance.balance < amount) {
      throw new BadRequestException(
        `Saldo insuficiente. Membro tem ${balance?.balance || 0} pontos.`,
      );
    }

    // Debit member balance, return to cashbox atomically
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Liga não encontrada.');

    await this.prisma.$transaction(async (tx) => {
      await tx.leagueBalance.update({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        data: { balance: { decrement: amount } },
      });

      await tx.league.update({
        where: { id: leagueId },
        data: { cashbox: { increment: amount } },
      });

      await tx.leagueTransaction.create({
        data: {
          leagueId,
          fromUserId: adminId,
          toUserId: targetUserId,
          amount: -amount,
          type: 'ADMIN_DEBIT',
          description: `Débito do administrador: -${amount} pontos (membro → caixa)`,
        },
      });

      await tx.cashboxLog.create({
        data: {
          leagueId,
          type: 'DEPOSIT',
          amount,
          balanceAfter: league.cashbox + amount,
          description: `Retirada de ${amount} fichas de membro`,
        },
      });
    });
  }

  // ─── Diamond Conversion ────────────────────────────────────────────────

  /**
   * Convert diamonds to league balance
   */
  async convertDiamondsToBalance(
    userId: number,
    leagueId: number,
    dto: ConvertDiamondsLeagueDto,
  ) {
    // Verify user is a member of the league
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) throw new ForbiddenException('Você não é membro desta liga');

    // Only OWNER or MANAGER can convert diamonds to league balance
    if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
      throw new ForbiddenException(
        'Apenas o dono ou gestor da liga pode converter diamantes em saldo para apostas.',
      );
    }

    // Check user has enough diamonds
    const pointBalance = await this.prisma.pointBalance.findUnique({
      where: { userId },
    });

    if (!pointBalance || pointBalance.diamonds < dto.diamonds) {
      throw new BadRequestException(
        `Diamantes insuficientes. Você tem ${pointBalance?.diamonds || 0}, precisa de ${dto.diamonds}.`,
      );
    }

    // Calculate points
    const pointsToAdd = dto.diamonds * DIAMOND_CONVERSION_RATE;

    // Convert atomically
    await this.prisma.$transaction(async (tx) => {
      // Deduct diamonds
      await tx.pointBalance.update({
        where: { userId },
        data: { diamonds: { decrement: dto.diamonds } },
      });

      // Credit league balance
      await tx.leagueBalance.update({
        where: { leagueId_userId: { leagueId, userId } },
        data: { balance: { increment: pointsToAdd } },
      });

      // Create transaction record
      await tx.leagueTransaction.create({
        data: {
          leagueId,
          fromUserId: null,
          toUserId: userId,
          amount: pointsToAdd,
          type: 'DIAMOND_CONVERSION',
          description: `Conversão: ${dto.diamonds} diamantes -> ${pointsToAdd} pontos`,
        },
      });
    });
  }

  // ─── League-Scoped Betting ────────────────────────────────────────────

  /**
   * Get user's bet history in a league
   */
  async getLeagueBets(userId: number, leagueId: number, page = 1, limit = 20) {
    // Verify user is a member
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) throw new ForbiddenException('Você não é membro desta liga');

    const skip = (page - 1) * limit;

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where: {
          userId,
          betSlip: { leagueId },
        },
        include: {
          fixture: {
            select: {
              homeTeam: true,
              awayTeam: true,
              leagueName: true,
              startAt: true,
              status: true,
              scoreHome: true,
              scoreAway: true,
            },
          },
          odd: {
            include: { market: { select: { type: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.bet.count({
        where: {
          userId,
          betSlip: { leagueId },
        },
      }),
    ]);

    return {
      data: bets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get league transaction history (extrato)
   */
  async getLeagueTransactions(
    userId: number,
    leagueId: number,
    page = 1,
    limit = 20,
  ) {
    // Verify user is a member
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) throw new ForbiddenException('Você não é membro desta liga');

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.leagueTransaction.findMany({
        where: {
          leagueId,
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
        },
        include: {
          fromUser: {
            select: { id: true, name: true },
          },
          toUser: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.leagueTransaction.count({
        where: {
          leagueId,
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
        },
      }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Star Upgrade ──────────────────────────────────────────────────────

  /**
   * Get star tiers info (for frontend display)
   */
  getStarTiers() {
    return Object.entries(STAR_TIERS).map(([stars, tier]) => ({
      stars: parseInt(stars),
      maxMembers: tier.maxMembers,
      maxManagers: tier.maxManagers,
      cost: getStarUpgradeCost(parseInt(stars)),
    }));
  }

  /**
   * Upgrade league stars (owner only, costs diamonds)
   */
  async upgradeLeagueStars(userId: number, leagueId: number, targetStars: number) {
    if (targetStars < 1 || targetStars > 5) {
      throw new BadRequestException('Nível de estrelas deve ser entre 1 e 5.');
    }

    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Liga não encontrada.');
    if (league.isOfficial) throw new BadRequestException('Liga oficial não pode ser evoluída.');
    if (league.ownerId !== userId) throw new ForbiddenException('Apenas o dono pode evoluir a liga.');

    // Calculate cost based on target level
    const cost = getStarUpgradeCost(targetStars);

    // Check user has enough diamonds
    const userBalance = await this.prisma.pointBalance.findUnique({ where: { userId } });
    if (!userBalance || userBalance.diamonds < cost) {
      throw new BadRequestException(
        `Diamantes insuficientes. Você tem ${userBalance?.diamonds || 0}, precisa de ${cost}.`,
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + STAR_DURATION_DAYS);

    // Upgrade atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.league.update({
        where: { id: leagueId },
        data: {
          stars: targetStars,
          starsExpiresAt: expiresAt,
        },
      });

      await tx.pointBalance.update({
        where: { userId },
        data: { diamonds: { decrement: cost } },
      });

      await tx.leagueTransaction.create({
        data: {
          leagueId,
          toUserId: userId,
          amount: 0,
          type: 'STAR_UPGRADE',
          description: `Upgrade para ${targetStars}⭐ (${cost} diamantes, válido por 30 dias)`,
        },
      });
    });

    return {
      stars: targetStars,
      expiresAt,
      cost,
      tier: STAR_TIERS[targetStars],
    };
  }

  async toggleAutoApprove(userId: number, leagueId: number) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Liga não encontrada.');
    if (league.isOfficial) throw new BadRequestException('Liga oficial não pode alterar essa configuração.');
    if (league.ownerId !== userId) throw new ForbiddenException('Apenas o dono pode alterar essa configuração.');

    const updated = await this.prisma.league.update({
      where: { id: leagueId },
      data: { autoApprove: !league.autoApprove },
    });

    return { autoApprove: updated.autoApprove };
  }

  // ─── Manager Role ─────────────────────────────────────────────────────

  /**
   * Promote member to manager (owner only)
   */
  async promoteToManager(ownerId: number, leagueId: number, targetUserId: number, password: string) {
    // Validate owner password
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Usuário não encontrado.');
    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) throw new ForbiddenException('Senha incorreta.');

    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Liga não encontrada.');
    if (league.ownerId !== ownerId) throw new ForbiddenException('Apenas o dono pode promover gestores.');

    // Check star expiry for effective stars
    const now = new Date();
    let effectiveStars = league.stars;
    if (league.starsExpiresAt && league.starsExpiresAt < now && effectiveStars > 0) effectiveStars = 0;
    const tier = STAR_TIERS[effectiveStars] || STAR_TIERS[0];

    // Count current managers
    const managerCount = await this.prisma.leagueMember.count({
      where: { leagueId, role: 'MANAGER', status: 'ACTIVE' },
    });

    if (managerCount >= tier.maxManagers) {
      throw new BadRequestException(
        `Limite de gestores atingido (${tier.maxManagers}) para nível ${effectiveStars}⭐. Evolua a liga para adicionar mais gestores.`,
      );
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!membership) throw new NotFoundException('Membro não encontrado.');
    if (membership.role !== 'MEMBER') throw new BadRequestException('Apenas membros podem ser promovidos a gestor.');

    await this.prisma.leagueMember.update({
      where: { id: membership.id },
      data: { role: 'MANAGER' },
    });
  }

  /**
   * Demote manager back to member (owner only)
   */
  async demoteManager(ownerId: number, leagueId: number, targetUserId: number, password: string) {
    // Validate owner password
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Usuário não encontrado.');
    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) throw new ForbiddenException('Senha incorreta.');

    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Liga não encontrada.');
    if (league.ownerId !== ownerId) throw new ForbiddenException('Apenas o dono pode rebaixar gestores.');

    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!membership) throw new NotFoundException('Membro não encontrado.');
    if (membership.role !== 'MANAGER') throw new BadRequestException('Usuário não é gestor.');

    await this.prisma.leagueMember.update({
      where: { id: membership.id },
      data: { role: 'MEMBER' },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Generate random 6-char alphanumeric uppercase code
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Verify user is owner, admin, or manager of the league
   */
  private async verifyLeagueAdmin(userId: number, leagueId: number) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN' && membership.role !== 'MANAGER')) {
      throw new ForbiddenException('Você não tem permissão para realizar esta ação');
    }

    return membership;
  }

  /**
   * Check if league is over member limit (blocks transactions)
   */
  private async checkLeagueCapacity(leagueId: number) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league || league.isOfficial) return; // official league has no limit

    const now = new Date();
    let effectiveStars = league.stars;
    if (league.starsExpiresAt && league.starsExpiresAt < now && effectiveStars > 0) effectiveStars = 0;
    const tier = STAR_TIERS[effectiveStars] || STAR_TIERS[0];

    const memberCount = await this.prisma.leagueMember.count({
      where: { leagueId, status: 'ACTIVE' },
    });

    if (memberCount > tier.maxMembers) {
      throw new BadRequestException(
        `Liga acima do limite de membros (${memberCount}/${tier.maxMembers}). O dono precisa renovar/evoluir o nível de estrelas para transacionar crédito.`,
      );
    }
  }

  // ─── Cron: Expire Stars ──────────────────────────────────────────────

  @Cron('0 * * * *') // Every hour
  async checkExpiredStars() {
    try {
      const expired = await this.prisma.league.findMany({
        where: {
          stars: { gt: 0 },
          starsExpiresAt: { lt: new Date() },
          isOfficial: false,
        },
      });

      if (expired.length === 0) return;

      for (const league of expired) {
        await this.prisma.league.update({
          where: { id: league.id },
          data: { stars: 0, starsExpiresAt: null },
        });
        this.logger.warn(`League #${league.id} "${league.name}" stars expired → reset to 0`);
      }

      this.logger.log(`Expired stars reset for ${expired.length} league(s)`);
    } catch (err) {
      this.logger.error('Failed to check expired stars', err);
    }
  }
}
