import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Bets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let fixtureId: string;
  let oddId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Register and login test user
    const email = `e2e_bets_${Date.now()}@betbrinks.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Bets Test User',
        email,
        phone: `+5511${Math.floor(900000000 + Math.random() * 99999999)}`,
        password: 'TestPass123!',
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'TestPass123!' });

    accessToken = loginRes.body.data.accessToken;
    userId = loginRes.body.data.user.id;

    // Create test fixture and odd
    const fixture = await prisma.fixture.create({
      data: {
        apiFootballId: 999999 + Math.floor(Math.random() * 100000),
        homeTeam: 'E2E Home FC',
        awayTeam: 'E2E Away FC',
        league: 'E2E Test League',
        leagueId: 1,
        season: 2026,
        date: new Date(Date.now() + 86400000), // tomorrow
        status: 'NOT_STARTED',
        homeScore: null,
        awayScore: null,
      },
    });
    fixtureId = fixture.id;

    const market = await prisma.market.create({
      data: {
        fixtureId: fixture.id,
        type: 'MATCH_WINNER',
        active: true,
      },
    });

    const odd = await prisma.odd.create({
      data: {
        fixtureId: fixture.id,
        marketId: market.id,
        name: 'Casa',
        value: 2.15,
      },
    });
    oddId = odd.id;
  });

  afterAll(async () => {
    // Cleanup in order (respect foreign keys)
    await prisma.bet.deleteMany({ where: { userId } });
    await prisma.odd.deleteMany({ where: { fixtureId } });
    await prisma.market.deleteMany({ where: { fixtureId } });
    await prisma.fixture.delete({ where: { id: fixtureId } });
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.pointBalance.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  describe('POST /bets', () => {
    it('should place a bet successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fixtureId, oddId, amount: 100 })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.amount).toBe(100);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.oddValue).toBe(2.15);
      expect(res.body.data.potentialReturn).toBe(215);
    });

    it('should fail with amount below minimum (10)', async () => {
      await request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fixtureId, oddId, amount: 5 })
        .expect(400);
    });

    it('should fail with amount above maximum (10000)', async () => {
      await request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fixtureId, oddId, amount: 20000 })
        .expect(400);
    });

    it('should fail with invalid fixture ID', async () => {
      await request(app.getHttpServer())
        .post('/bets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fixtureId: 'invalid-id', oddId, amount: 100 })
        .expect(400);
    });

    it('should fail without auth', async () => {
      await request(app.getHttpServer())
        .post('/bets')
        .send({ fixtureId, oddId, amount: 100 })
        .expect(401);
    });
  });

  describe('GET /bets/active', () => {
    it('should return active bets', async () => {
      const res = await request(app.getHttpServer())
        .get('/bets/active')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].status).toBe('PENDING');
    });
  });

  describe('GET /bets/history', () => {
    it('should return bet history with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/bets/history?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.total).toBeDefined();
    });
  });
});
