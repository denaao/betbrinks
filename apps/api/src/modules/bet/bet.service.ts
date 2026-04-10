import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateBetDto } from './dto/create-bet.dto';
import { CreateBetSlipDto } from './dto/create-bet-slip.dto';
const MAX_DAILY_BETS = 50;
const OFFICIAL_LEAGUE_ID = 1; // Default league

@Injectable()
export class BetService {
  private readonly logger = new Logger(BetService.name);

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
    private redis: RedisService,
  ) {}

  // ─── Create Bet ────────────────────────────────────────────────────────

  async createBet(userId: number, dto: CreateBetDto) {
    // 1. Check daily bet limit
    await this.checkDailyLimit(userId);

    // 2. Determine league (default to Liga Oficial if not provided)
    const leagueId = dto.leagueId || OFFICIAL_LEAGUE_ID;

    // 3. Verify user is a member of the league
    const leagueMember = await this.prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!leagueMember) {
      throw new BadRequestException('Voce nao esta em uma liga ativa para fazer apostas.');
    }

    // 4. Validate fixture exists and is NOT_STARTED
    const fixture = await this.prisma.fixture.findUnique({
      where: { id: dto.fixtureId },
    });

    if (!fixture) throw new NotFoundException('Jogo nao encontrado.');
    if (fixture.status !== 'NOT_STARTED') {
      throw new BadRequestException('Apostas so podem ser feitas antes do jogo iniciar.');
    }

    // 5. Validate odd exists and is active
    const odd = await this.prisma.odd.findUnique({
      where: { id: dto.oddId },
      include: { market: true },
    });

    if (!odd) throw new NotFoundException('Odd nao encontrada.');
    if (odd.market.fixtureId !== dto.fixtureId) {
      throw new BadRequestException('Odd nao pertence a este jogo.');
    }
    if (odd.market.status !== 'active') {
      throw new BadRequestException('Mercado suspenso. Tente outro.');
    }

    // 6. Check for duplicate bet (same user, same odd)
    const existingBet = await this.prisma.bet.findFirst({
      where: {
        userId,
        oddId: dto.oddId,
        status: 'PENDING',
      },
    });

    if (existingBet) {
      throw new BadRequestException('Voce ja tem uma aposta pendente nesta odd.');
    }

    // 7. Calculate potential return
    const oddValue = parseFloat(odd.value.toString());
    const potentialReturn = Math.floor(dto.amount * oddValue);

    // 8. Check league balance
    const leagueBalance = await this.getLeagueBalance(userId, leagueId);
    if (leagueBalance < dto.amount) {
      throw new BadRequestException('Saldo insuficiente na liga para esta aposta.');
    }

    // 9. Debit from league balance
    await this.debitLeagueBalance(
      userId,
      leagueId,
      dto.amount,
      `Aposta: ${fixture.homeTeam} vs ${fixture.awayTeam} - ${odd.name} @${oddValue}`,
    );

    // 10. Create bet record
    const bet = await this.prisma.bet.create({
      data: {
        userId,
        fixtureId: dto.fixtureId,
        oddId: dto.oddId,
        amount: dto.amount,
        oddValue,
        potentialReturn,
        status: 'PENDING',
      },
      include: {
        fixture: {
          select: { homeTeam: true, awayTeam: true, leagueName: true, startAt: true, status: true },
        },
        odd: {
          include: { market: { select: { type: true } } },
        },
      },
    });

    // 11. Increment daily counter
    await this.incrementDailyCount(userId);

    this.logger.log(`Bet #${bet.id} created: user ${userId}, ${dto.amount} pts @${oddValue}, league ${leagueId}`);

    return this.mapBetResponse(bet, leagueId);
  }

  // ─── Create Bet Slip (Bilhete) ─────────────────────────────────────────

  async createBetSlip(userId: number, dto: CreateBetSlipDto) {
    await this.checkDailyLimit(userId);

    // Determine league (default to Liga Oficial if not provided)
    const leagueId = dto.leagueId || OFFICIAL_LEAGUE_ID;

    // Verify user is a member of the league
    const leagueMember = await this.prisma.leagueMember.findFirst({
      where: {
        leagueId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!leagueMember) {
      throw new BadRequestException('Voce nao esta em uma liga ativa para fazer apostas.');
    }

    // Validate all selections
    const validatedSelections: Array<{
      fixtureId: number;
      oddId: number;
      oddValue: number;
      oddName: string;
      marketType: string;
      homeTeam: string;
      awayTeam: string;
    }> = [];

    for (const sel of dto.selections) {
      const fixture = await this.prisma.fixture.findUnique({
        where: { id: sel.fixtureId },
      });
      if (!fixture) throw new NotFoundException(`Jogo #${sel.fixtureId} nao encontrado.`);
      if (fixture.status !== 'NOT_STARTED') {
        throw new BadRequestException(`${fixture.homeTeam} vs ${fixture.awayTeam}: jogo ja iniciou.`);
      }

      const odd = await this.prisma.odd.findUnique({
        where: { id: sel.oddId },
        include: { market: true },
      });
      if (!odd) throw new NotFoundException(`Odd #${sel.oddId} nao encontrada.`);
      if (odd.market.fixtureId !== sel.fixtureId) {
        throw new BadRequestException('Odd nao pertence ao jogo informado.');
      }
      if (odd.market.status !== 'active') {
        throw new BadRequestException(`Mercado suspenso: ${fixture.homeTeam} vs ${fixture.awayTeam}.`);
      }

      validatedSelections.push({
        fixtureId: sel.fixtureId,
        oddId: sel.oddId,
        oddValue: parseFloat(odd.value.toString()),
        oddName: odd.name,
        marketType: odd.market.type,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
      });
    }

    // Calculate combined odd and potential return
    const combinedOdd = validatedSelections.reduce((acc, s) => acc * s.oddValue, 1);
    const potentialReturn = Math.floor(dto.amount * combinedOdd);

    // Check league balance
    const leagueBalance = await this.getLeagueBalance(userId, leagueId);
    if (leagueBalance < dto.amount) {
      throw new BadRequestException('Saldo insuficiente na liga para esta aposta.');
    }

    // Debit from league balance ONCE for the entire slip
    const desc = validatedSelections.length === 1
      ? `Aposta: ${validatedSelections[0].homeTeam} vs ${validatedSelections[0].awayTeam}`
      : `Bilhete multiplo (${validatedSelections.length} selecoes)`;

    await this.debitLeagueBalance(userId, leagueId, dto.amount, desc);

    // Create slip + legs in a transaction
    const slip = await this.prisma.$transaction(async (tx) => {
      const betSlip = await tx.betSlip.create({
        data: {
          userId,
          leagueId,
          amount: dto.amount,
          combinedOdd,
          potentialReturn,
          status: 'PENDING',
        },
      });

      for (const sel of validatedSelections) {
        await tx.bet.create({
          data: {
            userId,
            betSlipId: betSlip.id,
            fixtureId: sel.fixtureId,
            oddId: sel.oddId,
            amount: dto.amount,
            oddValue: sel.oddValue,
            potentialReturn: Math.floor(dto.amount * sel.oddValue),
            status: 'PENDING',
          },
        });
      }

      return tx.betSlip.findUnique({
        where: { id: betSlip.id },
        include: {
          legs: {
            include: {
              fixture: {
                select: { homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true, leagueName: true, startAt: true, status: true },
              },
              odd: { include: { market: { select: { type: true } } } },
            },
          },
        },
      });
    });

    await this.incrementDailyCount(userId);

    this.logger.log(`BetSlip #${slip!.id} created: user ${userId}, ${dto.amount} pts, ${validatedSelections.length} legs, combined @${combinedOdd.toFixed(2)}, league ${leagueId}`);

    return this.mapSlipResponse(slip!);
  }

  // ─── Get Active Slips ─────────────────────────────────────────────────

  async getActiveSlips(userId: number) {
    const slips = await this.prisma.betSlip.findMany({
      where: { userId, status: 'PENDING' },
      include: {
        legs: {
          include: {
            fixture: {
              select: { homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true, leagueName: true, startAt: true, status: true, scoreHome: true, scoreAway: true },
            },
            odd: { include: { market: { select: { type: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return slips.map(s => this.mapSlipResponse(s));
  }

  // ─── Get Slip History ─────────────────────────────────────────────────

  async getSlipHistory(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [slips, total] = await Promise.all([
      this.prisma.betSlip.findMany({
        where: { userId, status: { not: 'PENDING' } },
        include: {
          legs: {
            include: {
              fixture: {
                select: { homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true, leagueName: true, startAt: true, status: true, scoreHome: true, scoreAway: true },
              },
              odd: { include: { market: { select: { type: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.betSlip.count({ where: { userId, status: { not: 'PENDING' } } }),
    ]);
    return {
      data: slips.map(s => this.mapSlipResponse(s)),
      total, page, limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Settle Slip ──────────────────────────────────────────────────────

  async settleSlip(slipId: number) {
    const slip = await this.prisma.betSlip.findUnique({
      where: { id: slipId },
      include: { legs: { include: { odd: { include: { market: true } }, fixture: true } } },
    });
    if (!slip || slip.status !== 'PENDING') return;

    // Check if all legs' fixtures are finished
    const allFinished = slip.legs.every(l => l.fixture.status === 'FINISHED');
    if (!allFinished) return; // Not all games finished yet

    // Check each leg
    let allWon = true;
    for (const leg of slip.legs) {
      const fix = leg.fixture;
      const homeScore = fix.scoreHome ?? 0;
      const awayScore = fix.scoreAway ?? 0;
      const totalGoals = homeScore + awayScore;

      const winningOutcomes: Record<string, string> = {
        MATCH_WINNER: homeScore > awayScore ? 'Casa' : awayScore > homeScore ? 'Fora' : 'Empate',
        OVER_UNDER_25: totalGoals > 2.5 ? 'Mais 2.5' : 'Menos 2.5',
        BOTH_TEAMS_SCORE: (homeScore > 0 && awayScore > 0) ? 'Sim' : 'Nao',
      };

      const isWon = leg.odd.name === winningOutcomes[leg.odd.market.type];
      await this.prisma.bet.update({
        where: { id: leg.id },
        data: { status: isWon ? 'WON' : 'LOST', settledAt: new Date() },
      });
      if (!isWon) allWon = false;
    }

    // Update slip status
    if (allWon) {
      const leagueId = slip.leagueId || OFFICIAL_LEAGUE_ID;
      await this.creditLeagueBalance(
        slip.userId,
        leagueId,
        slip.potentialReturn,
        `Bilhete #${slip.id} ganho! +${slip.potentialReturn} pontos`,
      );
    }

    await this.prisma.betSlip.update({
      where: { id: slipId },
      data: { status: allWon ? 'WON' : 'LOST', settledAt: new Date() },
    });

    this.logger.log(`BetSlip #${slipId} settled: ${allWon ? 'WON' : 'LOST'} (${slip.legs.length} legs)`);
  }

  // ─── Get Active Bets ───────────────────────────────────────────────────

  async getActiveBets(userId: number, leagueId?: number) {
    const bets = await this.prisma.bet.findMany({
      where: {
        userId,
        status: 'PENDING',
        betSlip: leagueId ? { leagueId } : undefined,
      },
      include: {
        fixture: {
          select: { homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true, leagueName: true, startAt: true, status: true, scoreHome: true, scoreAway: true },
        },
        odd: {
          include: { market: { select: { type: true } } },
        },
        betSlip: {
          select: { leagueId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bets.map((b) => this.mapBetResponse(b, b.betSlip?.leagueId));
  }

  // ─── Get Bet History ───────────────────────────────────────────────────

  async getBetHistory(userId: number, leagueId?: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where: {
          userId,
          status: { not: 'PENDING' },
          betSlip: leagueId ? { leagueId } : undefined,
        },
        include: {
          fixture: {
            select: { homeTeam: true, awayTeam: true, homeLogo: true, awayLogo: true, leagueName: true, startAt: true, status: true, scoreHome: true, scoreAway: true },
          },
          odd: {
            include: { market: { select: { type: true } } },
          },
          betSlip: {
            select: { leagueId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.bet.count({
        where: {
          userId,
          status: { not: 'PENDING' },
          betSlip: leagueId ? { leagueId } : undefined,
        },
      }),
    ]);

    return {
      data: bets.map((b) => this.mapBetResponse(b, b.betSlip?.leagueId)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Get Bet by ID ─────────────────────────────────────────────────────

  async getBetById(betId: number, userId: number) {
    const bet = await this.prisma.bet.findFirst({
      where: { id: betId, userId },
      include: {
        fixture: {
          select: { homeTeam: true, awayTeam: true, leagueName: true, startAt: true, status: true },
        },
        odd: {
          include: { market: { select: { type: true } } },
        },
      },
    });

    if (!bet) throw new NotFoundException('Aposta nao encontrada.');
    return this.mapBetResponse(bet);
  }

  // ─── Settle Bets for a Fixture ─────────────────────────────────────────

  /**
   * Called after a fixture finishes. Evaluates all pending bets:
   *  - MATCH_WINNER: compare with score result
   *  - OVER_UNDER_25: compare total goals with 2.5
   *  - BOTH_TEAMS_SCORE: check if both scored
   */
  async settleBets(fixtureId: number) {
    const fixture = await this.prisma.fixture.findUnique({
      where: { id: fixtureId },
    });

    if (!fixture) throw new NotFoundException('Jogo nao encontrado.');
    if (fixture.status !== 'FINISHED') {
      throw new BadRequestException('Jogo ainda nao terminou.');
    }
    if (fixture.isSettled) {
      throw new BadRequestException('Apostas ja foram liquidadas para este jogo.');
    }

    const homeScore = fixture.scoreHome ?? 0;
    const awayScore = fixture.scoreAway ?? 0;
    const totalGoals = homeScore + awayScore;

    // Determine winning outcomes per market
    const winningOutcomes: Record<string, string> = {};

    // MATCH_WINNER
    if (homeScore > awayScore) winningOutcomes['MATCH_WINNER'] = 'Casa';
    else if (awayScore > homeScore) winningOutcomes['MATCH_WINNER'] = 'Fora';
    else winningOutcomes['MATCH_WINNER'] = 'Empate';

    // OVER_UNDER_25
    winningOutcomes['OVER_UNDER_25'] = totalGoals > 2.5 ? 'Mais 2.5' : 'Menos 2.5';

    // BOTH_TEAMS_SCORE
    winningOutcomes['BOTH_TEAMS_SCORE'] = (homeScore > 0 && awayScore > 0) ? 'Sim' : 'Nao';

    // Get all pending bets for this fixture
    const pendingBets = await this.prisma.bet.findMany({
      where: { fixtureId, status: 'PENDING' },
      include: {
        odd: {
          include: { market: true },
        },
        betSlip: {
          select: { leagueId: true },
        },
      },
    });

    this.logger.log(`Settling ${pendingBets.length} bets for fixture #${fixtureId} (${homeScore}-${awayScore})`);

    let wonCount = 0;
    let lostCount = 0;

    for (const bet of pendingBets) {
      const marketType = bet.odd.market.type;
      const winningName = winningOutcomes[marketType];
      const isWon = bet.odd.name === winningName;

      if (isWon) {
        // Credit winnings to league balance
        const leagueId = bet.betSlip?.leagueId || OFFICIAL_LEAGUE_ID;
        await this.creditLeagueBalance(
          bet.userId,
          leagueId,
          bet.potentialReturn,
          `Aposta ganha! +${bet.potentialReturn} pontos`,
        );

        await this.prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'WON', settledAt: new Date() },
        });
        wonCount++;
      } else {
        await this.prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'LOST', settledAt: new Date() },
        });
        lostCount++;
      }
    }

    // Update market results
    const markets = await this.prisma.market.findMany({ where: { fixtureId } });
    for (const market of markets) {
      await this.prisma.market.update({
        where: { id: market.id },
        data: {
          status: 'settled',
          result: winningOutcomes[market.type] || null,
        },
      });
    }

    // Mark fixture as settled
    await this.prisma.fixture.update({
      where: { id: fixtureId },
      data: { isSettled: true },
    });

    this.logger.log(`Fixture #${fixtureId} settled: ${wonCount} won, ${lostCount} lost`);

    return {
      fixtureId,
      totalBets: pendingBets.length,
      won: wonCount,
      lost: lostCount,
      score: `${homeScore} - ${awayScore}`,
    };
  }

  // ─── Private: League Balance Helpers ───────────────────────────────────

  private async getLeagueBalance(userId: number, leagueId: number): Promise<number> {
    const balance = await this.prisma.leagueBalance.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
    });

    return balance?.balance || 0;
  }

  private async debitLeagueBalance(
    userId: number,
    leagueId: number,
    amount: number,
    description: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get or create balance
      let balance = await tx.leagueBalance.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

      if (!balance) {
        balance = await tx.leagueBalance.create({
          data: {
            leagueId,
            userId,
            balance: 0,
          },
        });
      }

      // Check balance
      if (balance.balance < amount) {
        throw new BadRequestException('Saldo insuficiente na liga para esta aposta.');
      }

      // Debit balance
      await tx.leagueBalance.update({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
        data: {
          balance: { decrement: amount },
        },
      });

      // Create transaction record
      await tx.leagueTransaction.create({
        data: {
          leagueId,
          fromUserId: null,
          toUserId: userId,
          amount: -amount,
          type: 'BET_PLACED',
          description,
        },
      });
    });
  }

  private async creditLeagueBalance(
    userId: number,
    leagueId: number,
    amount: number,
    description: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get or create balance
      let balance = await tx.leagueBalance.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

      if (!balance) {
        balance = await tx.leagueBalance.create({
          data: {
            leagueId,
            userId,
            balance: 0,
          },
        });
      }

      // Credit balance
      await tx.leagueBalance.update({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
        data: {
          balance: { increment: amount },
        },
      });

      // Create transaction record
      await tx.leagueTransaction.create({
        data: {
          leagueId,
          fromUserId: null,
          toUserId: userId,
          amount,
          type: 'BET_WON',
          description,
        },
      });
    });
  }

  // ─── Private: Daily Limit ─────────────────────────────────────────────

  private async checkDailyLimit(userId: number) {
    const key = `daily_bets:${userId}:${this.todayDate()}`;
    const count = await this.redis.get(key);

    if (count && parseInt(count) >= MAX_DAILY_BETS) {
      throw new BadRequestException(
        `Limite diario de ${MAX_DAILY_BETS} apostas atingido. Tente novamente amanha!`,
      );
    }
  }

  private async incrementDailyCount(userId: number) {
    const key = `daily_bets:${userId}:${this.todayDate()}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 86400); // 24h TTL
  }

  // ─── Private: Helpers ─────────────────────────────────────────────────

  private mapBetResponse(bet: any, leagueId?: number | null) {
    return {
      id: bet.id,
      fixtureId: bet.fixtureId,
      leagueId: leagueId || OFFICIAL_LEAGUE_ID,
      fixture: {
        homeTeam: bet.fixture.homeTeam,
        awayTeam: bet.fixture.awayTeam,
        homeLogo: bet.fixture.homeLogo,
        awayLogo: bet.fixture.awayLogo,
        league: bet.fixture.leagueName,
        startAt: bet.fixture.startAt,
        status: bet.fixture.status,
        scoreHome: bet.fixture.scoreHome,
        scoreAway: bet.fixture.scoreAway,
      },
      marketType: bet.odd.market.type,
      oddName: bet.odd.name,
      oddValue: parseFloat(bet.oddValue.toString()),
      amount: bet.amount,
      potentialReturn: bet.potentialReturn,
      status: bet.status,
      createdAt: bet.createdAt,
      settledAt: bet.settledAt,
    };
  }

  private mapSlipResponse(slip: any) {
    return {
      id: slip.id,
      type: slip.legs.length === 1 ? 'SIMPLE' : 'MULTIPLE',
      amount: slip.amount,
      combinedOdd: parseFloat(slip.combinedOdd.toString()),
      potentialReturn: slip.potentialReturn,
      status: slip.status,
      createdAt: slip.createdAt,
      settledAt: slip.settledAt,
      legs: slip.legs.map((leg: any) => ({
        id: leg.id,
        fixtureId: leg.fixtureId,
        fixture: {
          homeTeam: leg.fixture.homeTeam,
          awayTeam: leg.fixture.awayTeam,
          homeLogo: leg.fixture?.homeLogo,
          awayLogo: leg.fixture?.awayLogo,
          league: leg.fixture.leagueName,
          startAt: leg.fixture.startAt,
          status: leg.fixture.status,
          scoreHome: leg.fixture?.scoreHome,
          scoreAway: leg.fixture?.scoreAway,
        },
        marketType: leg.odd.market.type,
        oddName: leg.odd.name,
        oddValue: parseFloat(leg.oddValue.toString()),
        status: leg.status,
      })),
    };
  }

  private todayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
