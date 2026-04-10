import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { RegisterTokenDto } from './dto/register-token.dto';

// Notification payload type
interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private redis: RedisService) {}

  // ─── Register FCM Token ────────────────────────────────────────────────

  async registerToken(userId: number, dto: RegisterTokenDto) {
    const key = `fcm:${userId}`;
    await this.redis.setJson(key, {
      token: dto.token,
      platform: dto.platform,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`FCM token registered for user ${userId} (${dto.platform})`);
    return { message: 'Token registrado com sucesso.' };
  }

  // ─── Remove Token (logout) ─────────────────────────────────────────────

  async removeToken(userId: number) {
    await this.redis.del(`fcm:${userId}`);
    return { message: 'Token removido.' };
  }

  // ─── Send Push Notification ────────────────────────────────────────────

  async sendToUser(userId: number, payload: PushPayload) {
    const tokenData = await this.redis.getJson<{ token: string; platform: string }>(`fcm:${userId}`);
    if (!tokenData) {
      this.logger.debug(`No FCM token for user ${userId}, skipping push.`);
      return;
    }

    await this.sendFcmMessage(tokenData.token, payload);
  }

  async sendToMultiple(userIds: number[], payload: PushPayload) {
    const promises = userIds.map((id) => this.sendToUser(id, payload));
    await Promise.allSettled(promises);
  }

  // ─── Pre-built Notifications ───────────────────────────────────────────

  async notifyBetWon(userId: number, amount: number, matchName: string) {
    await this.sendToUser(userId, {
      title: 'Aposta Ganha!',
      body: `Voce ganhou ${amount} pontos em ${matchName}!`,
      data: { type: 'bet_won', screen: 'MyBets' },
    });
  }

  async notifyBetLost(userId: number, matchName: string) {
    await this.sendToUser(userId, {
      title: 'Resultado do Jogo',
      body: `Seu palpite em ${matchName} nao acertou. Tente novamente!`,
      data: { type: 'bet_lost', screen: 'MyBets' },
    });
  }

  async notifyDailyBonus(userId: number) {
    await this.sendToUser(userId, {
      title: 'Bonus Diario Disponivel!',
      body: 'Entre no app e colete seus 50 pontos gratis!',
      data: { type: 'daily_bonus', screen: 'Profile' },
    });
  }

  async notifyAchievement(userId: number, achievementName: string) {
    await this.sendToUser(userId, {
      title: 'Conquista Desbloqueada!',
      body: `Voce desbloqueou: ${achievementName}`,
      data: { type: 'achievement', screen: 'Profile' },
    });
  }

  async notifyDiamondsReceived(userId: number, diamonds: number) {
    await this.sendToUser(userId, {
      title: 'Diamantes Creditados!',
      body: `${diamonds} diamantes foram adicionados a sua conta.`,
      data: { type: 'diamonds', screen: 'DiamondStore' },
    });
  }

  // ─── Private: FCM HTTP v1 ──────────────────────────────────────────────

  private async sendFcmMessage(token: string, payload: PushPayload) {
    // TODO: Implement Firebase Admin SDK or FCM HTTP v1 API
    // POST https://fcm.googleapis.com/v1/projects/{project}/messages:send
    //
    // For now, log in development
    this.logger.log(`[PUSH] -> ${token.substring(0, 20)}... | ${payload.title}: ${payload.body}`);

    // In production, use firebase-admin:
    // const messaging = admin.messaging();
    // await messaging.send({
    //   token,
    //   notification: { title: payload.title, body: payload.body },
    //   data: payload.data,
    //   android: { priority: 'high' },
    //   apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    // });
  }
}
