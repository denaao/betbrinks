import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { JoinLeagueDto } from './dto/join-league.dto';
import { TransferBalanceDto } from './dto/transfer-balance.dto';
import { ConvertDiamondsLeagueDto } from './dto/convert-diamonds.dto';

const DIAMOND_CONVERSION_RATE = 5; // 1 diamond = 5 points
const MAX_INVITE_CODE_RETRIES = 10;

@Injectable()
export class UserLeagueService {
  private readonly logger = new Logger(UserLeagueService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Liga Oficial ──────────────────────────────────────────────────────

  /**
   * Find or create the Liga Oficial (singleton)
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
          name: 'Liga Oficial',
          inviteCode: 'OFICIAL',
          isOfficial: true,
          ownerId: null,
        },
      });
      this.logger.log(`Created Liga Oficial with ID ${ligaOficial.id}`);
    }

    // Cache for 24 hours
    await this.redis.set(cacheKey, ligaOficial.id.toString(), 86400);

    return ligaOficial;
  }

  // ─── User's Leagues ────────────────────────────────────────────────────

  /**
   * Get all leagues user belongs to (Liga Oficial first, then private by name)
   */
  async getUserLeagues(userId: number) {
    // Get Liga Oficial first
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

    // Check if user is in Liga Oficial
    const isInLigaOficial = ligaOficial ? memberships.some((m) => m.leagueId === ligaOficial.id) : false;

    const result: any[] = [];

    // Add Liga Oficial if user exists in it
    if (isInLigaOficial && ligaOficial) {
      const memberIndex = memberships.findIndex((m) => m.leagueId === ligaOficial.id);
      if (memberIndex >= 0) {
        result.push({
          id: ligaOficial.id,
          name: ligaOficial.name,
          inviteCode: ligaOficial.inviteCode,
          isOfficial: true,
          role: memberships[memberIndex].role,
          balance: balanceMap.get(ligaOficial.id) || 0,
          memberCount: memberCounts[memberIndex],
        });
      }
    }

    // Add private leagues
    memberships.forEach((m, index) => {
      if (!m.league.isOfficial) {
        result.push({
          id: m.league.id,
          name: m.league.name,
          inviteCode: m.league.inviteCode,
          isOfficial: false,
          role: m.role,
          balance: balanceMap.get(m.leagueId) || 0,
          memberCount: memberCounts[index],
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

    const result: any = {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      isOfficial: league.isOfficial,
      role: membership.role,
      memberCount,
      balance: balance?.balance || 0,
      createdAt: league.createdAt,
    };

    // Include members if user is owner or admin
    if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
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

      result.members = members.map((m: any) => ({
        userId: m.userId,
        name: m.user.name,
        cpf: m.user.cpf,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        balance: balMap.get(m.userId) || 0,
        joinedAt: m.joinedAt,
      }));
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

    // Create league, member, and balance atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const league = await tx.league.create({
        data: {
          name: dto.name,
          inviteCode,
          isOfficial: false,
          ownerId: userId,
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

      return league;
    });

    return result;
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
    await this.verifyLeagueAdmin(adminId, leagueId);

    if (adminId === targetUserId) {
      throw new BadRequestException('Você não pode se remover da liga');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!membership) {
      throw new NotFoundException('Membro não encontrado');
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

    // Verify target is a member
    const targetMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Membro não encontrado');
    }

    // Credit balance atomically
    await this.prisma.$transaction(async (tx) => {
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
          description: `Crédito do administrador: +${amount} pontos`,
        },
      });
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

    // Debit balance atomically
    await this.prisma.$transaction(async (tx) => {
      await tx.leagueBalance.update({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        data: { balance: { decrement: amount } },
      });

      await tx.leagueTransaction.create({
        data: {
          leagueId,
          fromUserId: adminId,
          toUserId: targetUserId,
          amount: -amount,
          type: 'ADMIN_DEBIT',
          description: `Débito do administrador: -${amount} pontos`,
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
   * Verify user is owner or admin of the league
   */
  private async verifyLeagueAdmin(userId: number, leagueId: number) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new ForbiddenException('Você não tem permissão para realizar esta ação');
    }
  }
}
