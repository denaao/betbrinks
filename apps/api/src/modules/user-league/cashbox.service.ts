import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const PLATFORM_FEE_RATE = 0.10; // 10% taxa da plataforma
const DIAMOND_CONVERSION_RATE = 5; // 1 diamante = 5 fichas

@Injectable()
export class CashboxService {
  private readonly logger = new Logger(CashboxService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Deposit: Owner buys diamonds → cashbox ────────────────────────────

  /**
   * Owner deposits diamonds into the league cashbox.
   * Deducts diamonds from user's balance, converts to points, adds to league cashbox.
   */
  async depositToCashbox(userId: number, leagueId: number, diamonds: number) {
    if (diamonds <= 0) throw new BadRequestException('Quantidade de diamantes deve ser maior que 0');

    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new BadRequestException('Liga não encontrada');
    if (league.ownerId !== userId) throw new BadRequestException('Apenas o dono da liga pode depositar no caixa');

    // Check user has enough diamonds
    const userBalance = await this.prisma.pointBalance.findUnique({ where: { userId } });
    if (!userBalance || userBalance.diamonds < diamonds) {
      throw new BadRequestException(
        `Diamantes insuficientes. Você tem ${userBalance?.diamonds || 0}, precisa de ${diamonds}.`,
      );
    }

    const points = diamonds * DIAMOND_CONVERSION_RATE;

    await this.prisma.$transaction(async (tx) => {
      // Deduct diamonds from user
      await tx.pointBalance.update({
        where: { userId },
        data: { diamonds: { decrement: diamonds } },
      });

      // Add to league cashbox
      const updatedLeague = await tx.league.update({
        where: { id: leagueId },
        data: {
          cashbox: { increment: points },
          cashboxInitial: league.cashboxInitial === 0 ? points : { increment: points },
          isOpen: true, // reopen if was closed
        },
      });

      // Log the deposit
      await tx.cashboxLog.create({
        data: {
          leagueId,
          type: 'DEPOSIT',
          amount: points,
          balanceAfter: updatedLeague.cashbox,
          description: `Depósito: ${diamonds} diamantes → ${points} fichas`,
        },
      });

      // Record point transaction for user
      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'DIAMOND_CONVERSION',
          amount: -(diamonds * DIAMOND_CONVERSION_RATE),
          balanceAfter: userBalance.points, // points balance unchanged, only diamonds
          description: `Depósito no caixa da liga "${league.name}": ${diamonds} diamantes`,
        },
      });
    });

    this.logger.log(`Owner ${userId} deposited ${diamonds} diamonds (${points} points) to league ${leagueId} cashbox`);

    return { diamonds, points, newCashbox: league.cashbox + points };
  }

  // ─── Bet Lost: Cashbox receives (amount - 10% platform fee) ────────────

  /**
   * Called when a bet is lost. The league cashbox receives the bet amount minus 10% platform fee.
   */
  async onBetLost(leagueId: number, betAmount: number, betSlipId?: number) {
    const platformFee = Math.floor(betAmount * PLATFORM_FEE_RATE);
    const cashboxReceives = betAmount - platformFee;

    await this.prisma.$transaction(async (tx) => {
      // Add to cashbox
      const updatedLeague = await tx.league.update({
        where: { id: leagueId },
        data: { cashbox: { increment: cashboxReceives } },
      });

      // Log cashbox credit
      await tx.cashboxLog.create({
        data: {
          leagueId,
          type: 'BET_LOST',
          amount: cashboxReceives,
          balanceAfter: updatedLeague.cashbox,
          betSlipId,
          description: `Aposta perdida: +${cashboxReceives} fichas (aposta: ${betAmount}, taxa: ${platformFee})`,
        },
      });

      // Log platform fee
      if (platformFee > 0) {
        await tx.cashboxLog.create({
          data: {
            leagueId,
            type: 'PLATFORM_FEE',
            amount: -platformFee,
            balanceAfter: updatedLeague.cashbox,
            betSlipId,
            description: `Taxa plataforma (10%): ${platformFee} fichas`,
          },
        });
      }

      // Check if cashbox is still healthy, reopen if it was closed
      if (!updatedLeague.isOpen && updatedLeague.cashbox > updatedLeague.cashboxMinAlert) {
        await tx.league.update({
          where: { id: leagueId },
          data: { isOpen: true },
        });
      }
    });

    this.logger.log(`League ${leagueId} cashbox +${cashboxReceives} (bet lost, fee: ${platformFee})`);
  }

  // ─── Bet Won: Cashbox pays out the winnings ────────────────────────────

  /**
   * Called when a bet is won. The cashbox pays the profit (potentialReturn - amount wagered).
   * Returns false if cashbox cannot cover the payout (should not happen if validation was done at bet time).
   */
  async onBetWon(leagueId: number, payout: number, betSlipId?: number): Promise<boolean> {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) return false;

    await this.prisma.$transaction(async (tx) => {
      // Deduct from cashbox
      const updatedLeague = await tx.league.update({
        where: { id: leagueId },
        data: { cashbox: { decrement: payout } },
      });

      // Log cashbox debit
      await tx.cashboxLog.create({
        data: {
          leagueId,
          type: 'BET_WON',
          amount: -payout,
          balanceAfter: updatedLeague.cashbox,
          betSlipId,
          description: `Aposta ganha: -${payout} fichas pagos ao jogador`,
        },
      });

      // Check if cashbox is running low → close for new bets and alert owner
      if (updatedLeague.cashbox <= updatedLeague.cashboxMinAlert) {
        await tx.league.update({
          where: { id: leagueId },
          data: { isOpen: false },
        });
        this.logger.warn(
          `League ${leagueId} cashbox LOW (${updatedLeague.cashbox}). Closing for new bets. Owner needs to restock.`,
        );
        // TODO: Send push notification to owner
      }
    });

    this.logger.log(`League ${leagueId} cashbox -${payout} (bet won)`);
    return true;
  }

  // ─── Validate: Can league accept a new bet? ────────────────────────────

  /**
   * Check if the league cashbox can cover a potential payout.
   * Called BEFORE placing a bet.
   */
  async canAcceptBet(leagueId: number, potentialPayout: number): Promise<{ ok: boolean; reason?: string }> {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) return { ok: false, reason: 'Liga não encontrada' };

    // Liga oficial não tem caixa
    if (league.isOfficial) return { ok: true };

    if (!league.isOpen) {
      return { ok: false, reason: 'A liga está fechada para novas apostas. O caixa precisa ser reabastecido pelo dono.' };
    }

    // Calculate reserved amount: sum of potentialReturn for all PENDING bets in this league
    const pendingBets = await this.prisma.bet.aggregate({
      where: { betSlip: { leagueId }, status: 'PENDING' },
      _sum: { potentialReturn: true },
    });
    const pendingSlips = await this.prisma.betSlip.aggregate({
      where: { leagueId, status: 'PENDING' },
      _sum: { potentialReturn: true },
    });
    const reserved = (pendingBets._sum.potentialReturn || 0) + (pendingSlips._sum.potentialReturn || 0);
    const available = league.cashbox - reserved;

    if (available < potentialPayout) {
      return {
        ok: false,
        reason: `Caixa da liga insuficiente. Caixa: ${league.cashbox} fichas, reservado para apostas pendentes: ${reserved}, disponivel: ${available}, retorno potencial: ${potentialPayout}. Peca ao dono da liga para reabastecer.`,
      };
    }

    return { ok: true };
  }

  // ─── Get Cashbox Info ──────────────────────────────────────────────────

  async getCashboxInfo(leagueId: number) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new BadRequestException('Liga não encontrada');

    const recentLogs = await this.prisma.cashboxLog.findMany({
      where: { leagueId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      cashbox: league.cashbox,
      cashboxInitial: league.cashboxInitial,
      cashboxMinAlert: league.cashboxMinAlert,
      isOpen: league.isOpen,
      healthPercent: league.cashboxInitial > 0
        ? Math.round((league.cashbox / league.cashboxInitial) * 100)
        : 0,
      recentLogs,
    };
  }

  // ─── Withdraw from Cashbox (Owner) ─────────────────────────────────────

  async withdrawFromCashbox(userId: number, leagueId: number, amount: number) {
    if (amount <= 0) throw new BadRequestException('Valor deve ser maior que 0');

    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new BadRequestException('Liga não encontrada');
    if (league.ownerId !== userId) throw new BadRequestException('Apenas o dono pode sacar do caixa');
    if (league.cashbox < amount) throw new BadRequestException('Saldo insuficiente no caixa');

    const diamonds = Math.floor(amount / DIAMOND_CONVERSION_RATE);
    if (diamonds <= 0) throw new BadRequestException('Valor mínimo para saque é 5 fichas (1 diamante)');

    const pointsDeducted = diamonds * DIAMOND_CONVERSION_RATE; // round down to exact diamond conversion

    await this.prisma.$transaction(async (tx) => {
      // Deduct from cashbox
      const updatedLeague = await tx.league.update({
        where: { id: leagueId },
        data: { cashbox: { decrement: pointsDeducted } },
      });

      // Credit diamonds to owner
      await tx.pointBalance.update({
        where: { userId },
        data: { diamonds: { increment: diamonds } },
      });

      // Log
      await tx.cashboxLog.create({
        data: {
          leagueId,
          type: 'WITHDRAWAL',
          amount: -pointsDeducted,
          balanceAfter: updatedLeague.cashbox,
          description: `Saque: ${pointsDeducted} fichas → ${diamonds} diamantes`,
        },
      });

      // Check if cashbox is now low
      if (updatedLeague.cashbox <= updatedLeague.cashboxMinAlert) {
        await tx.league.update({
          where: { id: leagueId },
          data: { isOpen: false },
        });
      }
    });

    return { diamonds, pointsDeducted, newCashbox: league.cashbox - pointsDeducted };
  }
}
