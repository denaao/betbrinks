import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Points (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Register and login test user
    const email = `e2e_points_${Date.now()}@betbrinks.com`;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Points Test User',
        email,
        phone: `+5511${Math.floor(900000000 + Math.random() * 99999999)}`,
        password: 'TestPass123!',
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'TestPass123!' });

    accessToken = loginRes.body.data.accessToken;
    userId = loginRes.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.pointBalance.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  describe('GET /points/balance', () => {
    it('should return initial balance of 1000 points', async () => {
      const res = await request(app.getHttpServer())
        .get('/points/balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.points).toBe(1000);
      expect(res.body.data.diamonds).toBe(0);
    });

    it('should fail without auth', async () => {
      await request(app.getHttpServer())
        .get('/points/balance')
        .expect(401);
    });
  });

  describe('POST /points/daily-bonus', () => {
    it('should collect daily bonus successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/points/daily-bonus')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.points).toBeDefined();
      expect(res.body.data.points).toBeGreaterThan(1000);
    });

    it('should fail on second daily bonus same day', async () => {
      await request(app.getHttpServer())
        .post('/points/daily-bonus')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /points/transactions', () => {
    it('should return transaction history', async () => {
      const res = await request(app.getHttpServer())
        .get('/points/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/points/transactions?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
      expect(res.body.data.total).toBeDefined();
    });
  });
});
