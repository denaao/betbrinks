import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PurchaseDiamondDto } from './dto/purchase-diamond.dto';
import { ConvertDiamondsToLeagueDto } from './dto/convert-diamonds-to-league.dto';

const DIAMOND_PACKAGES = [
  { id: 'starter', name: 'Starter', diamonds: 100, bonusPoints: 500, priceBRL: 4.9, priceFormatted: 'R$ 4,90' },
  { id: 'popular', name: 'Popular', diamonds: 500, bonusPoints: 2500, priceBRL: 19.9, priceFormatted: 'R$ 19,90' },
  { id: 'pro', name: 'Pro', diamonds: 1200, bonusPoints: 6000, priceBRL: 39.9, priceFormatted: 'R$ 39,90' },
  { id: 'vip', name: 'VIP', diamonds: 3000, bonusPoints: 15000, priceBRL: 79.9, priceFormatted: 'R$ 79,90' },
];

@Injectable()
export class DiamondService {
  private readonly logger = new Logger(DiamondService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Get Packages ──────────────────────────────────────────────────────

  getPackages() {
    return DIAMOND_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      diamonds: pkg.diamonds,
      bonusPoints: pkg.bonusPoints,
      priceBRL: pkg.priceBRL,
      priceFormatted: pkg.priceFormatted,
    }));
  }

  // ─── Convert Diamonds to League Balance ────────────────────────────────

  async convertDiamondsToLeague(
    userId: number,
    leagueId: number,
    diamonds: number,
  ): Promise<{ pointsAdded: number; newBalance: number }> {
    // Validate user has enough diamonds (create record if missing)
    let balance = await this.prisma.pointBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      balance = await this.prisma.pointBalance.create({
        data: { userId, points: 0, diamonds: 0 },
      });
    }

    if (balance.diamonds < diamonds) {
      throw new BadRequestException(
        `Diamantes insuficientes. Voce tem ${balance.diamonds}, precisa de ${diamonds}.`,
      );
    }

    // Validate league exists and user is a member
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new BadRequestException('Liga nao encontrada.');
    }

    const member = await this.prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: { leagueId, userId },
      },
    });

    if (!member) {
      throw new BadRequestException('Usuario nao e membro da liga.');
    }

    // In private leagues, only the owner can convert diamonds to balance
    if (!league.isOfficial && league.ownerId !== userId) {
      throw new BadRequestException(
        'Em ligas privadas, apenas o dono pode converter diamantes em saldo. Seus diamantes podem ser usados para upgrades no clube.',
      );
    }

    // Get conversion rate from SystemConfig
    const configRate = await this.prisma.systemConfig.findUnique({
      where: { key: 'DIAMOND_TO_POINTS_RATE' },
    });

    const RATE = configRate ? parseInt(configRate.value) : 5;
    const pointsToAdd = diamonds * RATE;

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct diamonds from PointBalance
      const updatedBalance = await tx.pointBalance.update({
        where: { userId },
        data: {
          diamonds: { decrement: diamonds },
        },
      });

      // 2. Credit points to LeagueBalance
      let leagueBalance = await tx.leagueBalance.findUnique({
        where: {
          leagueId_userId: { leagueId, userId },
        },
      });

      if (!leagueBalance) {
        leagueBalance = await tx.leagueBalance.create({
          data: {
            leagueId,
            userId,
            balance: pointsToAdd,
          },
        });
      } else {
        leagueBalance = await tx.leagueBalance.update({
          where: { id: leagueBalance.id },
          data: {
            balance: { increment: pointsToAdd },
          },
        });
      }

      // 3. Create LeagueTransaction record
      await tx.leagueTransaction.create({
        data: {
          leagueId,
          toUserId: userId,
          amount: pointsToAdd,
          type: 'DIAMOND_CONVERSION',
          description: `Conversao: ${diamonds} diamantes -> ${pointsToAdd} pontos`,
        },
      });

      return {
        pointsAdded: pointsToAdd,
        newBalance: leagueBalance.balance,
      };
    });

    return result;
  }

  // ─── Purchase History ──────────────────────────────────────────────────

  async getPurchaseHistory(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      this.prisma.diamondPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.diamondPurchase.count({ where: { userId } }),
    ]);

    return {
      data: purchases.map((p) => ({
        id: p.id,
        packageId: p.packageId,
        diamonds: p.diamonds,
        priceBrl: parseFloat(p.priceBrl.toString()),
        platform: p.platform,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Initiate Purchase ─────────────────────────────────────────────────

  async purchase(userId: number, dto: PurchaseDiamondDto) {
    const pkg = DIAMOND_PACKAGES.find((p) => p.id === dto.packageId);
    if (!pkg) throw new BadRequestException('Pacote nao encontrado.');

    // Prevent duplicate receipts
    const existing = await this.prisma.diamondPurchase.findFirst({
      where: { storeReceipt: dto.storeReceipt, status: { not: 'FAILED' } },
    });
    if (existing) throw new BadRequestException('Recibo ja utilizado.');

    // Create pending purchase
    const purchase = await this.prisma.diamondPurchase.create({
      data: {
        userId,
        packageId: dto.packageId,
        diamonds: pkg.diamonds,
        priceBrl: pkg.priceBRL,
        platform: dto.platform,
        storeReceipt: dto.storeReceipt,
        status: 'PENDING',
      },
    });

    // Verify receipt with store (async)
    // In production, this would call Google Play / App Store APIs
    // For now, auto-verify in development
    try {
      const isValid = await this.verifyStoreReceipt(dto.platform, dto.storeReceipt);

      if (isValid) {
        await this.creditDiamonds(purchase.id, userId, pkg.diamonds);
        this.logger.log(`Purchase #${purchase.id} verified: ${pkg.diamonds} diamonds for user ${userId}`);

        return {
          message: `${pkg.diamonds} diamantes adicionados a sua conta!`,
          purchaseId: purchase.id,
          diamonds: pkg.diamonds,
          status: 'VERIFIED',
        };
      } else {
        await this.prisma.diamondPurchase.update({
          where: { id: purchase.id },
          data: { status: 'FAILED' },
        });

        throw new BadRequestException('Compra nao verificada pela loja. Tente novamente.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      this.logger.error(`Purchase verification failed for #${purchase.id}`, err);
      // Leave as PENDING for manual review
      return {
        message: 'Compra em processamento. Os diamantes serao creditados em breve.',
        purchaseId: purchase.id,
        diamonds: pkg.diamonds,
        status: 'PENDING',
      };
    }
  }

  // ─── Verify Pending Purchases (Admin/Cron) ─────────────────────────────

  async verifyPendingPurchases() {
    const pending = await this.prisma.diamondPurchase.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let verified = 0;
    for (const purchase of pending) {
      try {
        const isValid = await this.verifyStoreReceipt(purchase.platform, purchase.storeReceipt || '');
        if (isValid) {
          await this.creditDiamonds(purchase.id, purchase.userId, purchase.diamonds);
          verified++;
        }
      } catch {
        // Skip for next retry
      }
    }

    return { processed: pending.length, verified };
  }

  // ─── Private: Credit Diamonds ──────────────────────────────────────────

  private async creditDiamonds(purchaseId: number, userId: number, diamonds: number) {
    // Get the package to find bonusPoints
    const purchase = await this.prisma.diamondPurchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException('Compra nao encontrada.');
    }

    const pkg = DIAMOND_PACKAGES.find((p) => p.id === purchase.packageId);
    if (!pkg) {
      throw new NotFoundException('Pacote nao encontrado.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.diamondPurchase.update({
        where: { id: purchaseId },
        data: { status: 'VERIFIED' },
      });

      // Credit both diamonds and bonus points (upsert to handle missing record)
      await tx.pointBalance.upsert({
        where: { userId },
        create: {
          userId,
          diamonds,
          points: pkg.bonusPoints,
        },
        update: {
          diamonds: { increment: diamonds },
          points: { increment: pkg.bonusPoints },
        },
      });
    });
  }

  // ─── Private: Store Receipt Verification ───────────────────────────────

  private async verifyStoreReceipt(platform: string, receipt: string): Promise<boolean> {
    // TODO: Implement real store verification
    // - Google Play: googleapis.com/androidpublisher/v3/applications/{pkg}/purchases/products/{id}/tokens/{token}
    // - App Store: api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}

    // Development: auto-verify all receipts
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Production: would call real APIs here
    this.logger.warn(`Store verification not implemented for ${platform}`);
    return false;
  }
}
