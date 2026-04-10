import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const adminCreds = {
    email: `e2e_admin_${Date.now()}@betbrinks.com`,
    password: 'AdminPass123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Create test admin user
    const hashedPassword = await bcrypt.hash(adminCreds.password, 10);
    await prisma.adminUser.create({
      data: {
        name: 'E2E Admin',
        email: adminCreds.email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { adminUser: { email: adminCreds.email } } });
    await prisma.adminUser.deleteMany({ where: { email: adminCreds.email } });
    await app.close();
  });

  describe('POST /admin/login', () => {
    it('should login admin with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/login')
        .send(adminCreds)
        .expect(200);

      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.admin).toBeDefined();
      expect(res.body.data.admin.email).toBe(adminCreds.email);
      expect(res.body.data.admin.password).toBeUndefined();

      adminToken = res.body.data.token;
    });

    it('should fail with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/admin/login')
        .send({ email: adminCreds.email, password: 'wrong' })
        .expect(401);
    });

    it('should fail with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/admin/login')
        .send({ email: 'nobody@test.com', password: 'pass' })
        .expect(401);
    });
  });

  describe('GET /admin/dashboard', () => {
    it('should return dashboard KPIs', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const kpis = res.body.data;
      expect(kpis.totalUsers).toBeDefined();
      expect(kpis.totalBets).toBeDefined();
      expect(typeof kpis.totalUsers).toBe('number');
    });

    it('should fail without admin token', async () => {
      await request(app.getHttpServer())
        .get('/admin/dashboard')
        .expect(401);
    });
  });

  describe('GET /admin/users', () => {
    it('should return paginated users list', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.users || res.body.data.items).toBeDefined();
      expect(res.body.data.total).toBeDefined();
    });

    it('should support search', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users?search=e2e')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /admin/financial', () => {
    it('should return financial summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/financial')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const summary = res.body.data;
      expect(summary.totalRevenue).toBeDefined();
      expect(summary.totalPurchases).toBeDefined();
    });
  });

  describe('GET /admin/configs', () => {
    it('should return system configs', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });
  });

  describe('GET /admin/audit-logs', () => {
    it('should return audit logs (login entry should exist)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const logs = res.body.data.logs || res.body.data.items || [];
      expect(logs.length).toBeGreaterThan(0);
      // The admin login should have been logged
      const loginLog = logs.find((l: any) => l.action === 'LOGIN');
      expect(loginLog).toBeDefined();
    });
  });
});
