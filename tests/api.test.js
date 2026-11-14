import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
import { createDatabase } from '../server/db.js';

const ADMIN_PASSWORD = 'secret12345';

function validPayload(overrides = {}) {
  return {
    gender: 'm',
    ageGroup: '25to35',
    scores: {
      confidence: 7,
      sensitivity: 5,
      initiative: 8,
      adaptability: 6,
      overall: 7,
    },
    ...overrides,
  };
}

function storedResponse(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-11-13T10:00:00.000Z',
    gender: 'm',
    ageGroup: '25to35',
    scores: {
      confidence: 7,
      sensitivity: 5,
      initiative: 8,
      adaptability: 6,
      overall: 7,
    },
    ...overrides,
  };
}

async function login(app, login = 'admin', password = ADMIN_PASSWORD) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { login, password },
  });

  const setCookie = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  return {
    response,
    cookie: cookie?.split(';')[0],
    setCookie: cookie,
  };
}

describe('API', () => {
  let db;
  let app;
  let admin;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    admin = db.insertAdmin({
      login: 'admin',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    });
    app = await buildApp({
      db,
      rateLimitEnabled: false,
      serveStatic: false,
    });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('public responses', () => {
    it('accepts a valid anonymous response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/responses',
        payload: validPayload(),
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ ok: true });
      expect(db.countResponses()).toBe(1);
    });

    it('rejects an invalid response and returns field errors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/responses',
        payload: validPayload({ gender: 'x', scores: { confidence: 99 } }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('validation');
      expect(response.json().fields.gender).toBeDefined();
      expect(response.json().fields['scores.confidence']).toBeDefined();
      expect(db.countResponses()).toBe(0);
    });

    it('rejects non-object payloads', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/responses',
        payload: [],
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('authentication', () => {
    it('requires authentication for admin endpoints', async () => {
      for (const url of [
        '/api/admin/stats',
        '/api/admin/responses',
        '/api/admin/admins',
        '/api/admin/export.csv',
      ]) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode).toBe(401);
      }
    });

    it('rejects wrong credentials', async () => {
      const { response } = await login(app, 'admin', 'wrong-password');
      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Неверный логин или пароль.');
    });

    it('logs in with HttpOnly SameSite cookie and returns the current admin', async () => {
      const { response, cookie, setCookie } = await login(app);

      expect(response.statusCode).toBe(200);
      expect(response.json().admin.login).toBe('admin');
      expect(cookie).toBeTruthy();
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      expect(setCookie).toContain('Path=/');

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(me.statusCode).toBe(200);
      expect(me.json().admin.id).toBe(admin.id);
    });

    it('logs out and invalidates the session', async () => {
      const { cookie } = await login(app);

      const logout = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie },
      });
      expect(logout.statusCode).toBe(204);

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });
      expect(me.statusCode).toBe(401);
    });
  });

  describe('admin data', () => {
    it('returns computed statistics', async () => {
      db.insertResponse(
        storedResponse({
          ageGroup: 'under25',
          scores: {
            confidence: 10,
            sensitivity: 10,
            initiative: 10,
            adaptability: 10,
            overall: 10,
          },
        }),
      );
      db.insertResponse(
        storedResponse({
          ageGroup: 'over35',
          scores: {
            confidence: 2,
            sensitivity: 2,
            initiative: 2,
            adaptability: 2,
            overall: 2,
          },
        }),
      );

      const { cookie } = await login(app);
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const stats = response.json();
      expect(stats.count).toBe(2);
      expect(stats.overallAverage).toBe(6);
      expect(stats.averages.confidence).toBe(6);
      expect(
        stats.ageDistribution.find((item) => item.value === 'under25').count,
      ).toBe(1);
      expect(stats.lastResponseAt).toBe('2026-11-13T10:00:00.000Z');
    });

    it('filters and paginates responses', async () => {
      db.insertResponse(
        storedResponse({ id: 'a', ageGroup: 'under25', gender: 'f' }),
      );
      db.insertResponse(
        storedResponse({ id: 'b', ageGroup: 'under25', gender: 'm' }),
      );
      db.insertResponse(
        storedResponse({ id: 'c', ageGroup: 'over35', gender: 'f' }),
      );

      const { cookie } = await login(app);
      const filtered = await app.inject({
        method: 'GET',
        url: '/api/admin/responses?ageGroup=under25&limit=1&offset=1',
        headers: { cookie },
      });

      expect(filtered.statusCode).toBe(200);
      const data = filtered.json();
      expect(data.total).toBe(2);
      expect(data.limit).toBe(1);
      expect(data.offset).toBe(1);
      expect(data.items).toHaveLength(1);
    });

    it('rejects invalid filters', async () => {
      const { cookie } = await login(app);
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/responses?gender=unknown',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('exports CSV with BOM and all scores', async () => {
      db.insertResponse(storedResponse({ id: 'csv-1' }));

      const { cookie } = await login(app);
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/export.csv',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.charCodeAt(0)).toBe(0xfeff);
      expect(response.body).toContain('Уверенность');
      expect(response.body).toContain('2026-11-13T10:00:00.000Z');
    });

    it('requires explicit confirmation to delete all responses', async () => {
      db.insertResponse(storedResponse());
      const { cookie } = await login(app);

      const rejected = await app.inject({
        method: 'DELETE',
        url: '/api/admin/responses',
        headers: { cookie },
        payload: {},
      });
      expect(rejected.statusCode).toBe(400);
      expect(db.countResponses()).toBe(1);

      const deleted = await app.inject({
        method: 'DELETE',
        url: '/api/admin/responses',
        headers: { cookie },
        payload: { confirm: true },
      });
      expect(deleted.statusCode).toBe(200);
      expect(deleted.json().deleted).toBe(1);
      expect(db.countResponses()).toBe(0);
    });
  });

  describe('admin management', () => {
    it('creates, lists and deactivates another administrator', async () => {
      const { cookie } = await login(app);

      const created = await app.inject({
        method: 'POST',
        url: '/api/admin/admins',
        headers: { cookie },
        payload: { login: 'manager', password: 'manager12345' },
      });

      expect(created.statusCode).toBe(201);
      expect(created.json().admin.login).toBe('manager');

      const duplicate = await app.inject({
        method: 'POST',
        url: '/api/admin/admins',
        headers: { cookie },
        payload: { login: 'MANAGER', password: 'manager12345' },
      });
      expect(duplicate.statusCode).toBe(409);

      const managerLogin = await login(app, 'manager', 'manager12345');
      expect(managerLogin.response.statusCode).toBe(200);

      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/admins',
        headers: { cookie },
      });
      expect(list.json().items).toHaveLength(2);

      const manager = list
        .json()
        .items.find((item) => item.login === 'manager');

      const deactivated = await app.inject({
        method: 'PATCH',
        url: `/api/admin/admins/${manager.id}`,
        headers: { cookie },
        payload: { active: false },
      });
      expect(deactivated.statusCode).toBe(200);
      expect(deactivated.json().admin.isActive).toBe(false);

      const managerMe = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: managerLogin.cookie },
      });
      expect(managerMe.statusCode).toBe(401);

      const managerLoginAgain = await login(app, 'manager', 'manager12345');
      expect(managerLoginAgain.response.statusCode).toBe(401);
    });

    it('does not allow an administrator to deactivate themselves', async () => {
      const { cookie } = await login(app);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/admins/${admin.id}`,
        headers: { cookie },
        payload: { active: false },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
