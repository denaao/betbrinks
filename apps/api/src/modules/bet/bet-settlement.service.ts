import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BetService } from './bet.service';

/**
 * Automatically settles bets and bet slips for finished fixtures every 3 minutes.
 */
@Injectable()
export class BetSettlementService {
  private readonly logger = new Logger(BetSettlementService.name);

  constructor(
    private prisma: PrismaService,
    private betService: BetService,
  ) {}

  @Cron('*/3 * * * *')
  async autoSettle() {
    // 1. Settle individual bets (legacy)
    const unsettledFixtures = await this.prisma.fixture.findMany({
      where: {
        status: 'FINISHED',
        isSettled: false,
        scoreHome: { not: null },
        scoreAway: { not: null },
      },
      select: { id: true, homeTeam: true, awayTeam: true },
    });

    if (unsettledFixtures.length) {
      this.logger.log(`Auto-settling ${unsettledFixtures.length} fixtures...`);

      for (const fixture of unsettledFixtures) {
        try {
          const result = await this.betService.settleBets(fixture.id);
          this.logger.log(
            `Settled ${fixture.homeTeam} vs ${fixture.awayTeam}: ` +
            `${result.won} won, ${result.lost} lost (${result.score})`,
          );
        } catch (err) {
          this.logger.error(`Failed to settle fixture #${fixture.id}`, err);
        }
      }
    }

    // 2. Settle bet slips — check slips that have at least one leg whose fixture just finished
    await this.settleSlips();
  }

  private async settleSlips() {
    // Find pending slips where ALL legs' fixtures are finished
    const pendingSlips = await this.prisma.betSlip.findMany({
      where: { status: 'PENDING' },
      include: {
        legs: {
          include: { fixture: { select: { status: true } } },
        },
      },
    });

    const readySlips = pendingSlips.filter(slip =>
      slip.legs.every(leg => leg.fixture.status === 'FINISHED'),
    );

    if (!readySlips.length) return;

    this.logger.log(`Auto-settling ${readySlips.length} bet slips...`);

    for (const slip of readySlips) {
      try {
        await this.betService.settleSlip(slip.id);
      } catch (err) {
        this.logger.error(`Failed to settle bet slip #${slip.id}`, err);
      }
    }
  }
}
