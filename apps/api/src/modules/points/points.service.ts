import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
const DAILY_BONUS_POINTS = 50;
import { ConvertDiamondsDto } from './dto/convert-diamonds.dto';

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  // ─── Balance ───────────────────────────────────────────────────────────

  async getBalance(userId: number) {
    const balance = await this.prisma.pointBalance.findUnique({
      where: { userId },
    });

    if (!balance) throw new NotFoundException('Saldo nao encontrado.');

    return { points: balance.points, diamonds: balance.diamonds };
  }

  // ─── Transactions ──────────────────────────────────────────────────────

  async getTransactions(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.pointTransaction.count({ where: { userId } }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Daily Bonus ───────────────────────────────────────────────────────

  async collectDailyBonus(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado.');

    // Check if already collected today
    if (user.lastBonusAt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastBonus = new Date(user.lastBonusAt);
      lastBonus.setHours(0, 0, 0, 0);

      if (lastBonus.getTime() === today.getTime()) {
        throw new BadRequestException('Bonus diario ja coletado hoje. Volte amanha!');
      }
    }

    // Credit daily bonus atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.pointBalance.update({
        where: { userId },
        data: { points: { increment: DAILY_BONUS_POINTS } },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'DAILY_BONUS',
          amount: DAILY_BONUS_POINTS,
          balanceAfter: balance.points,
          description: `Bonus diario: +${DAILY_BONUS_POINTS} pontos`,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { lastBonusAt: new Date() },
      });

      return balance;
    });

    return {
      message: `+${DAILY_BONUS_POINTS} pontos! Volte amanha para mais.`,
      pointsAdded: DAILY_BONUS_POINTS,
      newBalance: result.points,
    };
  }

  // ─── Convert Diamonds to Points ────────────────────────────────────────

  async convertDiamonds(userId: number, dto: ConvertDiamondsDto) {
    const balance = await this.prisma.pointBalance.findUnique({ where: { userId } });
    if (!balance) throw new NotFoundException('Saldo nao encontrado.');

    if (balance.diamonds < dto.diamonds) {
      throw new BadRequestException(
        `Diamantes insuficientes. Voce tem ${balance.diamonds}, precisa de ${dto.diamonds}.`,
      );
    }

    // TODO: get rate from SystemConfig (default 5 points per diamond)
    const RATE = 5;
    const pointsToAdd = dto.diamonds * RATE;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pointBalance.update({
        where: { userId },
        data: {
          diamonds: { decrement: dto.diamonds },
          points: { increment: pointsToAdd },
        },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'DIAMOND_CONVERSION',
          amount: pointsToAdd,
          balanceAfter: updated.points,
          description: `Conversao: ${dto.diamonds} diamantes -> ${pointsToAdd} pontos`,
        },
      });

      return updated;
    });

    return {
      message: `${dto.diamonds} diamantes convertidos em ${pointsToAdd} pontos!`,
      diamondsUsed: dto.diamonds,
      pointsAdded: pointsToAdd,
      newBalance: { points: result.points, diamonds: result.diamonds },
    };
  }

  // ─── Internal: Credit/Debit (used by BetModule) ────────────────────────

  async creditPoints(userId: number, amount: number, type: string, description: string, referenceId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.pointBalance.update({
        where: { userId },
        data: { points: { increment: amount } },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: type as any,
          amount,
          balanceAfter: balance.points,
          description,
          referenceId,
        },
      });

      return balance;
    });
  }

  async debitPoints(userId: number, amount: number, type: string, description: string, referenceId?: string) {
    const balance = await this.prisma.pointBalance.findUnique({ where: { userId } });
    if (!balance || balance.points < amount) {
      throw new BadRequestException('Pontos insuficientes.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pointBalance.update({
        where: { userId },
        data: { points: { decrement: amount } },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: type as any,
          amount: -amount,
          balanceAfter: updated.points,
          description,
          referenceId,
        },
      });

      return updated;
    });
  }
}
