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
        bets: { take: 20, orderBy: { createdAt: 'desc' }, include: { fixture: { select: { homeTeam: true, awayTeam: true } } } },
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

  async getFixtureManagement(page = 1, limit = 25) {
    const skip = (page - 1) * limit;

    const [fixtures, total] = await Promise.all([
      this.prisma.fixture.findMany({
        include: {
          _count: { select: { bets: true, markets: true } },
        },
        orderBy: { startAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.fixture.count(),
    ]);

    return {
      data: fixtures.map((f) => ({
        id: f.id,
        apiFootballId: f.apiFootballId,
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
}
