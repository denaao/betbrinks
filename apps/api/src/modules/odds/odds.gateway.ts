import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Cron } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OddsService } from './odds.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/odds',
})
export class OddsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OddsGateway.name);

  constructor(
    private oddsService: OddsService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * VULN-012 fix: Authenticate WebSocket connections via JWT.
   * The client must provide the token as a query param (?token=xxx)
   * or in the auth handshake (socket.io `auth: { token }` option).
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        client.handshake.query?.token as string;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token provided`);
        client.emit('error', { message: 'Autenticação necessária.' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // Attach user info to socket for downstream use
      (client as any).user = payload;
      this.logger.log(`Client connected: ${client.id} (user: ${payload.userId || payload.adminId})`);
    } catch (err) {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.emit('error', { message: 'Token inválido ou expirado.' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to live updates for a specific fixture.
   * Joins a room named "fixture:{fixtureId}".
   */
  @SubscribeMessage('subscribe-fixture')
  async handleSubscribeFixture(
    @MessageBody() data: { fixtureId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `fixture:${data.fixtureId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);

    // Send current fixture data immediately
    try {
      const fixture = await this.oddsService.getFixtureById(data.fixtureId);
      client.emit('fixture-update', fixture);
    } catch {
      client.emit('error', { message: 'Jogo nao encontrado.' });
    }

    return { event: 'subscribed', data: { fixtureId: data.fixtureId } };
  }

  /**
   * Client unsubscribes from a fixture room.
   */
  @SubscribeMessage('unsubscribe-fixture')
  async handleUnsubscribeFixture(
    @MessageBody() data: { fixtureId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `fixture:${data.fixtureId}`;
    await client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: 'unsubscribed', data: { fixtureId: data.fixtureId } };
  }

  /**
   * Client subscribes to all live fixture updates.
   */
  @SubscribeMessage('subscribe-live')
  async handleSubscribeLive(@ConnectedSocket() client: Socket) {
    await client.join('live-fixtures');
    this.logger.log(`Client ${client.id} joined live-fixtures room`);

    // Send current live fixtures
    try {
      const liveFixtures = await this.oddsService.getLiveFixtures();
      client.emit('live-fixtures-update', liveFixtures);
    } catch {
      // Silently fail
    }

    return { event: 'subscribed-live' };
  }

  @SubscribeMessage('unsubscribe-live')
  async handleUnsubscribeLive(@ConnectedSocket() client: Socket) {
    await client.leave('live-fixtures');
    return { event: 'unsubscribed-live' };
  }

  // ─── Broadcast Methods (called by Cron or external triggers) ──────────

  /**
   * Broadcasts updated fixture data to all clients subscribed to that fixture.
   */
  async broadcastFixtureUpdate(fixtureId: number) {
    try {
      const fixture = await this.oddsService.getFixtureById(fixtureId);
      this.server.to(`fixture:${fixtureId}`).emit('fixture-update', fixture);
    } catch (err) {
      this.logger.error(`Failed to broadcast fixture ${fixtureId}`, err);
    }
  }

  /**
   * Broadcasts all live fixtures to the live-fixtures room.
   */
  async broadcastLiveFixtures() {
    try {
      const liveFixtures = await this.oddsService.getLiveFixtures();
      this.server.to('live-fixtures').emit('live-fixtures-update', liveFixtures);
    } catch (err) {
      this.logger.error('Failed to broadcast live fixtures', err);
    }
  }

  /**
   * Every 30 seconds: push live fixture updates to WebSocket subscribers.
   */
  @Cron('*/30 * * * * *')
  async pushLiveUpdates() {
    if (!this.server) return;

    const adapter = this.server.adapter as any;
    const liveRoom = adapter?.rooms?.get('live-fixtures');
    if (!liveRoom?.size) return;

    await this.broadcastLiveFixtures();
  }
}
