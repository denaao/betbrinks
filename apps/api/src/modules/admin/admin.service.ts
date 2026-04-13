import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { maskCpf } from '../../common/utils/mask-cpf';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── Auth ──────────────────────────────────────────────────────────────

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais invalidas.');

    const token = await this.jwtService.signAsync(
      { adminId: admin.id, email: admin.email, role: admin.role },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '8h' },
    );

    await this.auditLog(admin.id, 'auth.login', 'admin_user', admin.id.toString());

    return {
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }

  // ─── Backoffice Unified Login (CPF) ─────────────────────────────────────

  // VULN-006 fix: Admin CPFs removed from source code.
  // Admin access is now determined solely by user.role === 'ADMIN' in the database.
  // To promote a user to admin, update their role directly in the database:
  //   UPDATE "User" SET role = 'ADMIN' WHERE cpf = '...'
  // Or use: prisma db push after adding the role via a secure admin endpoint.

  async backofficeLogin(cpf: string, password: string) {
    // Normalise CPF – remove non-digits
    const cpfClean = cpf.replace(/\D/g, '');

    // Search by CPF: try both formatted (000.000.000-00) and raw digits
    const cpfFormatted = cpfClean.length === 11
      ? `${cpfClean.slice(0,3)}.${cpfClean.slice(3,6)}.${cpfClean.slice(6,9)}-${cpfClean.slice(9)}`
      : cpfClean;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { cpf: cpfClean },
          { cpf: cpfFormatted },
        ],
      },
      include: {
        affiliateProfiles: {
          where: { isActive: true },
          include: { league: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) throw new UnauthorizedException('CPF ou senha inválidos.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('CPF ou senha inválidos.');

    // Admin: check role in DB only (VULN-006 fix: no more hardcoded CPF whitelist)
    const isAdmin = user.role === 'ADMIN';
    const isAffiliate = user.affiliateProfiles.length > 0;

    // Check if user is a league owner
    const ownedLeagues = await this.prisma.leagueMember.findMany({
      where: { userId: user.id, role: 'OWNER' },
      select: { leagueId: true },
    });
    const isOwner = ownedLeagues.length > 0;

    if (!isAdmin && !isAffiliate && !isOwner) {
      throw new UnauthorizedException('Acesso não autorizado ao backoffice.');
    }

    // Build affiliate summaries
    const affiliates = user.affiliateProfiles.map((a) => ({
      affiliateId: a.id,
      leagueId: a.leagueId,
      leagueName: a.league.name,
      affiliateCode: a.affiliateCode,
      revenueSharePct: a.revenueSharePct,
    }));

    // Determine role for JWT: ADMIN > OWNER > USER
    const jwtRole = isAdmin ? 'ADMIN' : isOwner ? 'OWNER' : 'USER';

    const token = await this.jwtService.signAsync(
      {
        userId: user.id,
        cpf: user.cpf,
        role: jwtRole,
        type: isAffiliate ? 'affiliate' : 'admin',
        affiliateIds: user.affiliateProfiles.map((a) => a.id),
      },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '24h' },
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        cpf: maskCpf(user.cpf),
        role: user.role,
      },
      isAdmin,
      isAffiliate,
      isOwner,
      affiliates,
    };
  }

  // ─── Dashboard KPIs ────────────────────────────────────────────────────

  async getDashboardKpis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      totalBets,
      betsToday,
      activeBets,
      totalDiamondRevenue,
      diamondRevenueMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.bet.count(),
      this.prisma.bet.count({ where: { createdAt: { gte: today } } }),
      this.prisma.bet.count({ where: { status: 'PENDING' } }),
      this.prisma.diamondPurchase.aggregate({
        where: { status: 'VERIFIED' },
        _sum: { priceBrl: true },
      }),
      this.prisma.diamondPurchase.aggregate({
        where: { status: 'VERIFIED', createdAt: { gte: monthAgo } },
        _sum: { priceBrl: true },
      }),
    ]);

    return {
      users: { total: totalUsers, newToday: newUsersToday, newThisWeek: newUsersWeek },
      bets: { total: totalBets, today: betsToday, active: activeBets },
      revenue: {
        total: parseFloat(totalDiamondRevenue._sum.priceBrl?.toString() || '0'),
        thisMonth: parseFloat(diamondRevenueMonth._sum.priceBrl?.toString() || '0'),
      },
    };
  }

  // ─── Chart Data ────────────────────────────────────────────────────────

  async getRegistrationChart(days = 30) {
    const results: { date: string; count: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await this.prisma.user.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });

      results.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    return results;
  }

  async getBetChart(days = 30) {
    const results: { date: string; placed: number; won: number; lost: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [placed, won, lost] = await Promise.all([
        this.prisma.bet.count({ where: { createdAt: { gte: dayStart, lte: dayEnd } } }),
        this.prisma.bet.count({ where: { settledAt: { gte: dayStart, lte: dayEnd }, status: 'WON' } }),
        this.prisma.bet.count({ where: { settledAt: { gte: dayStart, lte: dayEnd }, status: 'LOST' } }),
      ]);

      results.push({ date: dayStart.toISOString().split('T')[0], placed, won, lost });
    }

    return results;
  }

  // ─── CRM: Users ────────────────────────────────────────────────────────

  async getUsers(page = 1, limit = 25, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as any } },
            { email: { contains: search, mode: 'insensitive' as any } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { balance: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isVerified: u.isVerified,
        level: u.level,
        points: u.balance?.points ?? 0,
        diamonds: u.balance?.diamonds ?? 0,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserDetail(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        balance: true,
        bets: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            fixture: {
              select: {
                homeTeam: true,
                awayTeam: true,
                scoreHome: true,
                scoreAway: true,
                startAt: true,
                status: true,
                leagueName: true,
              },
            },
          },
        },
        transactions: { take: 20, orderBy: { createdAt: 'desc' } },
        purchases: { take: 10, orderBy: { createdAt: 'desc' } },
        achievements: { include: { achievement: true } },
      },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado.');

    const [totalBets, wonBets] = await Promise.all([
      this.prisma.bet.count({ where: { userId, status: { in: ['WON', 'LOST'] } } }),
      this.prisma.bet.count({ where: { userId, status: 'WON' } }),
    ]);

    return {
      ...user,
      passwordHash: undefined,
      stats: {
        totalBets,
        wonBets,
        winRate: totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0,
      },
    };
  }

  async blockUser(adminId: number, userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' }, // Using role to flag — could add blocked field
    });
    await this.auditLog(adminId, 'user.block', 'user', userId.toString());
    return { message: 'Usuario bloqueado.' };
  }

  async adjustPoints(adminId: number, userId: number, amount: number, description: string) {
    const balance = await this.prisma.pointBalance.update({
      where: { userId },
      data: { points: { increment: amount } },
    });

    await this.prisma.pointTransaction.create({
      data: {
        userId,
        type: 'ADMIN_ADJUSTMENT',
        amount,
        balanceAfter: balance.points,
        description: `[Admin] ${description}`,
      },
    });

    await this.auditLog(adminId, 'user.adjust_points', 'user', userId.toString(), JSON.stringify({ amount, description }));

    return { newBalance: balance.points };
  }

  // ─── Financial ─────────────────────────────────────────────────────────

  async getFinancialSummary() {
    const [
      totalRevenue,
      purchasesByPackage,
      purchasesByStatus,
      recentPurchases,
    ] = await Promise.all([
      this.prisma.diamondPurchase.aggregate({
        where: { status: 'VERIFIED' },
        _sum: { priceBrl: true },
        _count: true,
      }),
      this.prisma.diamondPurchase.groupBy({
        by: ['packageId'],
        where: { status: 'VERIFIED' },
        _sum: { priceBrl: true },
        _count: { id: true },
      }),
      this.prisma.diamondPurchase.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.diamondPurchase.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      totalRevenue: parseFloat(totalRevenue._sum.priceBrl?.toString() || '0'),
      totalPurchases: totalRevenue._count,
      byPackage: purchasesByPackage.map((p) => ({
        packageId: p.packageId,
        revenue: parseFloat(p._sum.priceBrl?.toString() || '0'),
        count: p._count.id,
      })),
      byStatus: purchasesByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      recentPurchases: recentPurchases.map((p) => ({
        id: p.id,
        userName: p.user.name,
        userEmail: p.user.email,
        packageId: p.packageId,
        diamonds: p.diamonds,
        priceBrl: parseFloat(p.priceBrl.toString()),
        status: p.status,
        platform: p.platform,
        createdAt: p.createdAt,
      })),
    };
  }

  // ─── System Config ─────────────────────────────────────────────────────

  async getConfigs() {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async updateConfig(adminId: number, dto: UpdateConfigDto) {
    const config = await this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      update: { value: dto.value },
      create: { key: dto.key, value: dto.value },
    });

    await this.auditLog(adminId, 'config.update', 'system_config', dto.key, JSON.stringify({ value: dto.value }));
    return config;
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { adminUser: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Fixture Management ────────────────────────────────────────────────

  async getFixtureManagement(page = 1, limit = 25, sportKey?: string, filter?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (sportKey) where.sportKey = sportKey;
    if (filter === 'live') where.status = { in: ['FIRST_HALF', 'SECOND_HALF', 'HALFTIME', 'EXTRA_TIME', 'PENALTIES', 'QUARTER_1', 'QUARTER_2', 'QUARTER_3', 'QUARTER_4', 'OVERTIME', 'SET_1', 'SET_2', 'SET_3', 'SET_4', 'SET_5', 'ROUND_1', 'ROUND_2', 'ROUND_3', 'ROUND_4', 'ROUND_5', 'IN_PROGRESS'] };
    else if (filter === 'upcoming') where.status = 'NOT_STARTED';
    else if (filter === 'finished') where.status = { in: ['FINISHED', 'CANCELLED', 'POSTPONED'] };

    const [fixtures, total] = await Promise.all([
      this.prisma.fixture.findMany({
        where,
        include: {
          _count: { select: { bets: true, markets: true } },
        },
        orderBy: { startAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.fixture.count({ where }),
    ]);

    return {
      data: fixtures.map((f) => ({
        id: f.id,
        apiFootballId: f.apiFootballId,
        sportKey: f.sportKey,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        leagueName: f.leagueName,
        startAt: f.startAt,
        status: f.status,
        scoreHome: f.scoreHome,
        scoreAway: f.scoreAway,
        isSettled: f.isSettled,
        totalBets: f._count.bets,
        totalMarkets: f._count.markets,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Leagues ───────────────────────────────────────────────────────────

  async getPrivateLeagues(page = 1, limit = 25) {
    const skip = (page - 1) * limit;

    const [leagues, total] = await Promise.all([
      this.prisma.league.findMany({
        where: { isOfficial: false },
        include: {
          owner: { select: { name: true, email: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.league.count({ where: { isOfficial: false } }),
    ]);

    return {
      data: leagues.map((l) => ({
        id: l.id,
        name: l.name,
        inviteCode: l.inviteCode,
        cashbox: l.cashbox,
        cashboxInitial: l.cashboxInitial,
        cashboxMinAlert: l.cashboxMinAlert,
        isOpen: l.isOpen,
        status: l.isOpen ? 'OPEN' : 'CLOSED',
        ownerName: l.owner?.name || '—',
        ownerEmail: l.owner?.email || '—',
        memberCount: l._count.members,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Private: Audit ────────────────────────────────────────────────────

  private async auditLog(
    adminUserId: number,
    action: string,
    targetType?: string,
    targetId?: string,
    details?: string,
  ) {
    await this.prisma.auditLog.create({
      data: { adminUserId, action, targetType, targetId, details },
    });
  }

  // ─── Owner Dashboard ──────────────────────────────────────────────────

  async getOwnerLeagues(userId: number) {
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId, role: 'OWNER' },
      include: {
        league: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      inviteCode: m.league.inviteCode,
      cashbox: m.league.cashbox,
      stars: m.league.stars,
      memberCount: m.league._count.members,
      createdAt: m.league.createdAt,
    }));
  }

  // ─── Owner CRM: Members with search & pagination ──────────────────
  async getOwnerMembers(userId: number, leagueId: number, page = 1, limit = 25, search?: string) {
    // Verify user is owner
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new UnauthorizedException('Acesso restrito ao dono da liga.');
    }

    const skip = (page - 1) * limit;

    // Build member query with search
    const whereClause: any = { leagueId, status: 'ACTIVE' };

    const members = await this.prisma.leagueMember.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, cpf: true, email: true, phone: true, createdAt: true, lastLoginAt: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Filter by search in-memory (name, cpf, email)
    let filtered = members;
    if (search) {
      const s = search.toLowerCase();
      filtered = members.filter((m) =>
        m.user.name?.toLowerCase().includes(s) ||
        m.user.cpf?.includes(s) ||
        m.user.email?.toLowerCase().includes(s) ||
        m.user.phone?.includes(s)
      );
    }

    const total = filtered.length;
    const paged = filtered.slice(skip, skip + limit);

    // Get balances
    const balances = await this.prisma.leagueBalance.findMany({ where: { leagueId } });
    const balMap = new Map(balances.map((b) => [b.userId, b.balance]));

    // Get affiliate referral links (AffiliateReferral has no leagueId, so query through affiliates of this league)
    const leagueAffiliates = await this.prisma.leagueAffiliate.findMany({
      where: { leagueId },
      select: { id: true, affiliateCode: true, user: { select: { name: true } } },
    });
    const affIds = leagueAffiliates.map((a) => a.id);
    const affMap = new Map(leagueAffiliates.map((a) => [a.id, { code: a.affiliateCode, name: a.user.name }]));

    const referrals = affIds.length > 0
      ? await this.prisma.affiliateReferral.findMany({
          where: { affiliateId: { in: affIds } },
        })
      : [];
    const refMap = new Map(referrals.map((r) => {
      const aff = affMap.get(r.affiliateId);
      return [r.userId, { affiliateId: r.affiliateId, code: aff?.code || '', name: aff?.name || '' }];
    }));

    // Get bet counts per user
    const userIds = paged.map((m) => m.userId);
    const betCounts = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { id: true },
    });
    const betMap = new Map(betCounts.map((b) => [b.userId, b._count.id]));

    return {
      data: paged.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        cpf: maskCpf(m.user.cpf),
        email: m.user.email,
        phone: m.user.phone,
        role: m.role,
        balance: balMap.get(m.userId) || 0,
        totalBets: betMap.get(m.userId) || 0,
        linkedAffiliate: refMap.get(m.userId) || null,
        joinedAt: m.joinedAt,
        lastLoginAt: m.user.lastLoginAt,
        createdAt: m.user.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Owner Financial: cashbox + transactions with pagination ──────
  async getOwnerFinancial(userId: number, leagueId: number, page = 1, limit = 50) {
    // Verify user is owner
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new UnauthorizedException('Acesso restrito ao dono da liga.');
    }

    const skip = (page - 1) * limit;

    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });

    // Get all balances for summary
    const balances = await this.prisma.leagueBalance.findMany({ where: { leagueId } });
    const totalDistributed = balances.reduce((s, b) => s + b.balance, 0);

    // Transaction totals by type
    const [transactions, totalTx] = await Promise.all([
      this.prisma.leagueTransaction.findMany({
        where: { leagueId },
        include: {
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.leagueTransaction.count({ where: { leagueId } }),
    ]);

    // Aggregate transaction types
    const txAggregates = await this.prisma.leagueTransaction.groupBy({
      by: ['type'],
      where: { leagueId },
      _sum: { amount: true },
      _count: { id: true },
    });
    const txSummary = txAggregates.map((t) => ({
      type: t.type,
      totalAmount: t._sum.amount || 0,
      count: t._count.id,
    }));

    // Affiliate commissions summary
    const affiliates = await this.prisma.leagueAffiliate.findMany({
      where: { leagueId },
      include: {
        user: { select: { name: true } },
        commissions: { select: { commissionAmt: true, leagueProfit: true } },
      },
    });
    const totalCommissions = affiliates.reduce((s, a) => s + a.commissions.reduce((cs, c) => cs + c.commissionAmt, 0), 0);
    const totalLeagueProfit = affiliates.reduce((s, a) => s + a.commissions.reduce((cs, c) => cs + c.leagueProfit, 0), 0);

    return {
      league: {
        id: league!.id,
        name: league!.name,
        cashbox: league!.cashbox,
        cashboxInitial: league!.cashboxInitial,
        cashboxMinAlert: league!.cashboxMinAlert,
      },
      summary: {
        cashbox: league!.cashbox,
        totalDistributed,
        totalCommissions,
        totalLeagueProfit,
        transactionsByType: txSummary,
      },
      transactions: {
        data: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          senderName: t.fromUser?.name || 'Sistema',
          receiverName: t.toUser?.name || 'Sistema',
          description: t.description,
          createdAt: t.createdAt,
        })),
        total: totalTx,
        page,
        limit,
        totalPages: Math.ceil(totalTx / limit),
      },
    };
  }

  // ─── Bets: Admin (all bets) ─────────────────────────────────────────
  async getAdminBets(page = 1, limit = 25, search?: string, status?: string, sportKey?: string, dateFrom?: string, dateTo?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (sportKey) where.fixture = { sportKey };

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
              id: true, homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true,
              scoreHome: true, scoreAway: true, startAt: true, status: true,
              leagueName: true, sportKey: true,
            },
          },
          odd: {
            select: { name: true, value: true, market: { select: { type: true } } },
          },
          betSlip: {
            select: { id: true, leagueId: true, league: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.bet.count({ where }),
    ]);

    // Get affiliate info for each bettor
    const userIds = [...new Set(bets.map((b) => b.userId))];
    const referrals = await this.prisma.affiliateReferral.findMany({
      where: { userId: { in: userIds } },
      include: {
        affiliate: { select: { affiliateCode: true, user: { select: { name: true } } } },
      },
    });
    const affMap = new Map(referrals.map((r) => [r.userId, {
      code: r.affiliate.affiliateCode,
      name: r.affiliate.user.name,
    }]));

    // Stats
    const [totalBets, totalWon, totalLost, totalPending] = await Promise.all([
      this.prisma.bet.count(),
      this.prisma.bet.count({ where: { status: 'WON' } }),
      this.prisma.bet.count({ where: { status: 'LOST' } }),
      this.prisma.bet.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      stats: { totalBets, totalWon, totalLost, totalPending },
      data: bets.map((b) => ({
        id: b.id,
        user: { id: b.user.id, name: b.user.name, cpf: maskCpf(b.user.cpf) },
        fixture: b.fixture,
        odd: { name: b.odd.name, value: parseFloat(b.odd.value.toString()), marketType: b.odd.market.type },
        league: b.betSlip?.league ? { id: b.betSlip.leagueId, name: b.betSlip.league.name } : null,
        amount: b.amount,
        oddValue: parseFloat(b.oddValue.toString()),
        potentialReturn: b.potentialReturn,
        status: b.status,
        affiliate: affMap.get(b.userId) || null,
        createdAt: b.createdAt,
        settledAt: b.settledAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Bets: Owner (league-scoped) ──────────────────────────────────────
  async getOwnerBets(userId: number, leagueId: number, page = 1, limit = 25, search?: string, status?: string, dateFrom?: string, dateTo?: string) {
    // Verify user is owner
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership || membership.role !== 'OWNER') {
      throw new UnauthorizedException('Acesso restrito ao dono da liga.');
    }

    const skip = (page - 1) * limit;

    // Get member IDs of this league
    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    const where: any = {
      betSlip: { leagueId },
    };
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
              id: true, homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true,
              scoreHome: true, scoreAway: true, startAt: true, status: true,
              leagueName: true, sportKey: true,
            },
          },
          odd: {
            select: { name: true, value: true, market: { select: { type: true } } },
          },
          betSlip: {
            select: { id: true, leagueId: true, league: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.bet.count({ where }),
    ]);

    // Get affiliate info
    const userIds = [...new Set(bets.map((b) => b.userId))];
    const leagueAffiliates = await this.prisma.leagueAffiliate.findMany({
      where: { leagueId },
      select: { id: true, affiliateCode: true, user: { select: { name: true } } },
    });
    const affIds = leagueAffiliates.map((a) => a.id);
    const affInfoMap = new Map(leagueAffiliates.map((a) => [a.id, { code: a.affiliateCode, name: a.user.name }]));

    const referrals = affIds.length > 0
      ? await this.prisma.affiliateReferral.findMany({
          where: { affiliateId: { in: affIds }, userId: { in: userIds } },
        })
      : [];
    const affMap = new Map(referrals.map((r) => {
      const aff = affInfoMap.get(r.affiliateId);
      return [r.userId, { code: aff?.code || '', name: aff?.name || '' }];
    }));

    // Stats for this league
    const baseWhere = { betSlip: { leagueId } };
    const [totalBets, totalWon, totalLost, totalPending] = await Promise.all([
      this.prisma.bet.count({ where: baseWhere }),
      this.prisma.bet.count({ where: { ...baseWhere, status: 'WON' } }),
      this.prisma.bet.count({ where: { ...baseWhere, status: 'LOST' } }),
      this.prisma.bet.count({ where: { ...baseWhere, status: 'PENDING' } }),
    ]);

    return {
      stats: { totalBets, totalWon, totalLost, totalPending },
      data: bets.map((b) => ({
        id: b.id,
        user: { id: b.user.id, name: b.user.name, cpf: maskCpf(b.user.cpf) },
        fixture: b.fixture,
        odd: { name: b.odd.name, value: parseFloat(b.odd.value.toString()), marketType: b.odd.market.type },
        league: b.betSlip?.league ? { id: b.betSlip.leagueId, name: b.betSlip.league.name } : null,
        amount: b.amount,
        oddValue: parseFloat(b.oddValue.toString()),
        potentialReturn: b.potentialReturn,
        status: b.status,
        affiliate: affMap.get(b.userId) || null,
        createdAt: b.createdAt,
        settledAt: b.settledAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOwnerDashboard(userId: number, leagueId: number) {
    // Verify user is owner
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership || membership.role !== 'OWNER') {
      throw new UnauthorizedException('Acesso restrito ao dono da liga.');
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    // ─── Members with balances ─────────────────────────────────────────
    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, cpf: true } } },
    });

    const balances = await this.prisma.leagueBalance.findMany({
      where: { leagueId },
    });
    const balMap = new Map(balances.map((b) => [b.userId, b.balance]));

    const memberList = members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      cpf: maskCpf(m.user.cpf),
      role: m.role,
      balance: balMap.get(m.userId) || 0,
    }));

    // ─── Affiliates with full details ──────────────────────────────────
    const affiliates = await this.prisma.leagueAffiliate.findMany({
      where: { leagueId },
      include: {
        user: { select: { id: true, name: true } },
        referrals: {
          include: { user: { select: { id: true, name: true } } },
        },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { referrals: true, commissions: true } },
      },
    });

    const affiliateList = affiliates.map((a) => {
      const totalCommission = a.commissions.reduce((s, c) => s + c.commissionAmt, 0);
      const totalProfit = a.commissions.reduce((s, c) => s + c.leagueProfit, 0);
      return {
        id: a.id,
        userId: a.userId,
        name: a.user.name,
        code: a.affiliateCode,
        revenueSharePct: a.revenueSharePct,
        creditLimit: a.creditLimit,
        creditUsed: a.creditUsed,
        isActive: a.isActive,
        referralCount: a._count.referrals,
        commissionCount: a._count.commissions,
        totalCommission,
        totalProfit,
        referrals: a.referrals.map((r) => ({
          userId: r.userId,
          name: r.user.name,
          joinedAt: r.joinedAt,
        })),
        recentCommissions: a.commissions.slice(0, 10).map((c) => ({
          id: c.id,
          betAmount: c.betAmount,
          leagueProfit: c.leagueProfit,
          commissionPct: c.commissionPct,
          commissionAmt: c.commissionAmt,
          level: c.level,
          createdAt: c.createdAt,
        })),
      };
    });

    // ─── Recent transactions ───────────────────────────────────────────
    const transactions = await this.prisma.leagueTransaction.findMany({
      where: { leagueId },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const transactionList = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      senderName: t.fromUser?.name || 'Sistema',
      receiverName: t.toUser?.name || 'Sistema',
      description: t.description,
      createdAt: t.createdAt,
    }));

    // ─── Summary stats ─────────────────────────────────────────────────
    const totalBalance = Array.from(balMap.values()).reduce((s, v) => s + v, 0);
    const totalMembers = members.length;
    const totalAffiliates = affiliates.length;
    const totalReferrals = affiliates.reduce((s, a) => s + a._count.referrals, 0);
    const totalCommissions = affiliateList.reduce((s, a) => s + a.totalCommission, 0);

    return {
      league: {
        id: league!.id,
        name: league!.name,
        inviteCode: league!.inviteCode,
        cashbox: league!.cashbox,
        stars: league!.stars,
      },
      stats: {
        totalMembers,
        totalBalance,
        totalAffiliates,
        totalReferrals,
        totalCommissions,
      },
      members: memberList,
      affiliates: affiliateList,
      transactions: transactionList,
    };
  }
}
