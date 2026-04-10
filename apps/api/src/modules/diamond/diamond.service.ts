import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PurchaseDiamondDto } from './dto/purchase-diamond.dto';
const DIAMOND_PACKAGES = [
  { id: 'starter', name: 'Starter', diamonds: 100, points: 500, priceBRL: 4.90 },
  { id: 'popular', name: 'Popular', diamonds: 500, points: 2500, priceBRL: 19.90 },
  { id: 'pro', name: 'Pro', diamonds: 1200, points: 6000, priceBRL: 39.90 },
  { id: 'vip', name: 'VIP', diamonds: 3000, points: 15000, priceBRL: 79.90 },
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
      bonusPoints: pkg.points,
      priceBRL: pkg.priceBRL,
      priceFormatted: `R$ ${pkg.priceBRL.toFixed(2).replace('.', ',')}`,
    }));
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
    await this.prisma.$transaction(async (tx) => {
      await tx.diamondPurchase.update({
        where: { id: purchaseId },
        data: { status: 'VERIFIED' },
      });

      await tx.pointBalance.update({
        where: { userId },
        data: { diamonds: { increment: diamonds } },
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
