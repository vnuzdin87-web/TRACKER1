import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';

import {
  AGE_GROUPS,
  GENDERS,
  LOW_DATA_THRESHOLD,
  PARAMS,
} from '../src/constants.js';
import {
  isValidAgeGroup,
  isValidGender,
  validateResponse,
} from '../src/validation.js';
import {
  getAgeDistribution,
  getAverageByParam,
  getCount,
  getLastResponseDate,
  getOverallAverage,
  getResponseAverage,
} from '../src/stats.js';
import {
  generatePassword,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isValidLogin,
  isValidPassword,
  normalizeLogin,
  verifyPassword,
} from './auth.js';
import { projectRoot } from './db.js';

const SESSION_COOKIE = 'tracker_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_PAGE_SIZE = 200;

function mapSessionAdmin(row) {
  return {
    id: row.id,
    login: row.login,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
  };
}

function parsePagination(query = {}) {
  const limitValue = Number(query.limit ?? 50);
  const offsetValue = Number(query.offset ?? 0);

  const limit =
    Number.isInteger(limitValue) && limitValue > 0
      ? Math.min(limitValue, MAX_PAGE_SIZE)
      : 50;
  const offset =
    Number.isInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0;

  return { limit, offset };
}

function normalizeDateBound(value, endOfDay = false) {
  if (typeof value !== 'string' || value.trim() === '') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFilters(query = {}) {
  const filters = {};

  if (query.gender) {
    if (!isValidGender(query.gender)) {
      return { ok: false, message: 'Некорректный фильтр по полу.' };
    }
    filters.gender = query.gender;
  }

  if (query.ageGroup) {
    if (!isValidAgeGroup(query.ageGroup)) {
      return { ok: false, message: 'Некорректный фильтр по возрасту.' };
    }
    filters.ageGroup = query.ageGroup;
  }

  if (query.from) {
    const from = normalizeDateBound(query.from, false);
    if (!from) {
      return { ok: false, message: 'Некорректная дата начала периода.' };
    }
    filters.from = from;
  }

  if (query.to) {
    const to = normalizeDateBound(query.to, true);
    if (!to) {
      return { ok: false, message: 'Некорректная дата окончания периода.' };
    }
    filters.to = to;
  }

  return { ok: true, filters };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",;\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(responses) {
  const genderLabels = new Map(GENDERS.map(({ value, label }) => [value, label]));
  const ageLabels = new Map(AGE_GROUPS.map(({ value, label }) => [value, label]));

  const header = [
    'Дата и время',
    'Пол',
    'Возраст',
    ...PARAMS.map(({ label }) => label),
    'Средний балл',
  ];

  const rows = responses.map((response) => [
    response.createdAt,
    genderLabels.get(response.gender) ?? response.gender,
    ageLabels.get(response.ageGroup) ?? response.ageGroup,
    ...PARAMS.map(({ key }) => response.scores[key]),
    getResponseAverage(response) ?? '',
  ]);

  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')}`;
}

function getSession(db, request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const row = db.findSession(tokenHash);

  if (!row) return null;

  const expiresAt = Date.parse(row.expires_at);
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    db.deleteSession(tokenHash);
    return null;
  }

  if (!row.is_active) {
    db.deleteSession(tokenHash);
    return null;
  }

  return {
    tokenHash,
    admin: mapSessionAdmin(row),
  };
}

function setSessionCookie(reply, token, cookieSecure) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieSecure,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

function clearSessionCookie(reply, cookieSecure) {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieSecure,
  });
}

export async function buildApp({
  db,
  logger = false,
  serveStatic = false,
  rateLimitEnabled = true,
  cookieSecure = false,
} = {}) {
  if (!db) {
    throw new Error('buildApp requires a database instance.');
  }

  const app = Fastify({
    logger,
    bodyLimit: 32 * 1024,
    trustProxy: process.env.TRUST_PROXY === '1',
  });

  app.decorateRequest('admin', null);
  app.decorateRequest('sessionTokenHash', null);

  await app.register(cookie);

  if (rateLimitEnabled) {
    await app.register(rateLimit, { global: false });
  }

  const dummyPasswordHash = await hashPassword(generatePassword(24));

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return;

    const origin = request.headers.origin;
    if (!origin) return;

    const host = request.headers.host;
    if (!host) return;

    const allowedOrigins = new Set([`http://${host}`, `https://${host}`]);
    if (!allowedOrigins.has(origin)) {
      return reply.code(403).send({
        error: 'forbidden_origin',
        message: 'Запрос отклонён.',
      });
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');

    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
    }

    return payload;
  });

  async function requireAdmin(request, reply) {
    const session = getSession(db, request);
    if (!session) {
      return reply.code(401).send({
        error: 'unauthorized',
        message: 'Требуется вход в панель администратора.',
      });
    }

    request.admin = session.admin;
    request.sessionTokenHash = session.tokenHash;
  }

  app.get('/api/health', async () => ({ ok: true }));

  app.post(
    '/api/responses',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.code(400).send({
          error: 'validation',
          message: 'Некорректный формат ответа.',
          fields: {},
        });
      }

      const { gender, ageGroup, scores } = body;
      const validation = validateResponse({ gender, ageGroup, scores });

      if (!validation.valid) {
        return reply.code(400).send({
          error: 'validation',
          message: 'Проверьте заполнение формы.',
          fields: validation.errors,
        });
      }

      const response = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        gender,
        ageGroup,
        scores: {
          confidence: scores.confidence,
          sensitivity: scores.sensitivity,
          initiative: scores.initiative,
          adaptability: scores.adaptability,
          overall: scores.overall,
        },
      };

      db.insertResponse(response);

      return reply.code(201).send({ ok: true });
    },
  );

  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.code(401).send({
          error: 'unauthorized',
          message: 'Неверный логин или пароль.',
        });
      }

      const login = normalizeLogin(body.login);
      const password = body.password;
      const adminRecord = isValidLogin(login)
        ? db.findAdminByLogin(login)
        : null;

      const passwordMatches = await verifyPassword(
        typeof password === 'string' ? password : '',
        adminRecord?.password_hash ?? dummyPasswordHash,
      );

      if (!adminRecord || !adminRecord.is_active || !passwordMatches) {
        return reply.code(401).send({
          error: 'unauthorized',
          message: 'Неверный логин или пароль.',
        });
      }

      db.deleteExpiredSessions();

      const token = generateSessionToken();
      const tokenHash = hashSessionToken(token);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

      db.createSession({
        tokenHash,
        adminId: adminRecord.id,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      db.setAdminLastLogin(adminRecord.id, now.toISOString());
      setSessionCookie(reply, token, cookieSecure);

      return reply.send({
        admin: mapSessionAdmin(adminRecord),
      });
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) {
      db.deleteSession(hashSessionToken(token));
    }

    clearSessionCookie(reply, cookieSecure);
    return reply.code(204).send();
  });

  app.get(
    '/api/auth/me',
    { preHandler: requireAdmin },
    async (request) => ({ admin: request.admin }),
  );

  app.get(
    '/api/admin/stats',
    { preHandler: requireAdmin },
    async () => {
      const responses = db.listAllResponses();
      const averages = {};

      for (const { key } of PARAMS) {
        averages[key] = getAverageByParam(responses, key);
      }

      return {
        count: getCount(responses),
        overallAverage: getOverallAverage(responses),
        averages,
        ageDistribution: getAgeDistribution(responses),
        lastResponseAt: getLastResponseDate(responses),
        lowDataThreshold: LOW_DATA_THRESHOLD,
        generatedAt: new Date().toISOString(),
      };
    },
  );

  app.get(
    '/api/admin/responses',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsedFilters = parseFilters(request.query);
      if (!parsedFilters.ok) {
        return reply.code(400).send({
          error: 'validation',
          message: parsedFilters.message,
        });
      }

      const { limit, offset } = parsePagination(request.query);
      return db.listResponses({
        limit,
        offset,
        ...parsedFilters.filters,
      });
    },
  );

  app.get(
    '/api/admin/export.csv',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsedFilters = parseFilters(request.query);
      if (!parsedFilters.ok) {
        return reply.code(400).send({
          error: 'validation',
          message: parsedFilters.message,
        });
      }

      const responses = db.listAllResponses(parsedFilters.filters);
      const date = new Date().toISOString().slice(0, 10);
      const csv = buildCsv(responses);

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="responses-${date}.csv"`,
      );

      return reply.send(csv);
    },
  );

  app.delete(
    '/api/admin/responses',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body;
      if (!body || typeof body !== 'object' || body.confirm !== true) {
        return reply.code(400).send({
          error: 'confirmation_required',
          message: 'Подтвердите удаление всех ответов.',
        });
      }

      const deleted = db.deleteAllResponses();
      return reply.send({ deleted });
    },
  );

  app.get(
    '/api/admin/admins',
    { preHandler: requireAdmin },
    async () => ({ items: db.listAdmins() }),
  );

  app.post(
    '/api/admin/admins',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.code(400).send({
          error: 'validation',
          message: 'Некорректные данные администратора.',
        });
      }

      const login = normalizeLogin(body.login);
      const password = body.password;

      if (!isValidLogin(login)) {
        return reply.code(400).send({
          error: 'validation',
          message:
            'Логин: от 3 до 32 символов, латинские буквы, цифры, точка, дефис или подчёркивание.',
        });
      }

      if (!isValidPassword(password)) {
        return reply.code(400).send({
          error: 'validation',
          message: 'Пароль должен содержать от 8 до 200 символов.',
        });
      }

      if (db.findAdminByLogin(login)) {
        return reply.code(409).send({
          error: 'conflict',
          message: 'Администратор с таким логином уже существует.',
        });
      }

      const passwordHash = await hashPassword(password);
      const admin = db.insertAdmin({ login, passwordHash });

      return reply.code(201).send({ admin });
    },
  );

  app.patch(
    '/api/admin/admins/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const targetRecord = db.findAdminById(request.params.id);
      if (!targetRecord) {
        return reply.code(404).send({
          error: 'not_found',
          message: 'Администратор не найден.',
        });
      }

      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.code(400).send({
          error: 'validation',
          message: 'Некорректные данные.',
        });
      }

      const hasActive = typeof body.active === 'boolean';
      const hasPassword = body.password !== undefined;

      if (!hasActive && !hasPassword) {
        return reply.code(400).send({
          error: 'validation',
          message: 'Нет изменений.',
        });
      }

      if (hasActive && !body.active) {
        if (targetRecord.id === request.admin.id) {
          return reply.code(400).send({
            error: 'validation',
            message: 'Нельзя отключить собственную учётную запись.',
          });
        }

        if (targetRecord.is_active && db.countActiveAdmins() <= 1) {
          return reply.code(400).send({
            error: 'validation',
            message: 'Нельзя отключить последнего активного администратора.',
          });
        }
      }

      let passwordHash;

      if (hasPassword) {
        if (!isValidPassword(body.password)) {
          return reply.code(400).send({
            error: 'validation',
            message: 'Пароль должен содержать от 8 до 200 символов.',
          });
        }
        passwordHash = await hashPassword(body.password);
      }

      const admin = db.updateAdmin(targetRecord.id, {
        isActive: hasActive ? body.active : undefined,
        passwordHash,
      });

      if (hasPassword) {
        if (targetRecord.id === request.admin.id) {
          db.deleteAdminSessionsExcept(
            targetRecord.id,
            request.sessionTokenHash,
          );
        } else {
          db.deleteAdminSessions(targetRecord.id);
        }
      }

      if (hasActive && body.active === false) {
        db.deleteAdminSessions(targetRecord.id);
      }

      return reply.send({ admin });
    },
  );

  if (serveStatic) {
    const distDir = path.join(projectRoot, 'dist');
    const indexPath = path.join(distDir, 'index.html');

    if (fs.existsSync(indexPath)) {
      await app.register(fastifyStatic, {
        root: distDir,
        prefix: '/',
        index: ['index.html'],
        maxAge: 0,
      });

      app.get('/admin', async (request, reply) => {
        reply.header('X-Robots-Tag', 'noindex, nofollow');
        return reply.sendFile('admin.html');
      });

      app.get('/admin/', async (request, reply) => {
        return reply.redirect('/admin', 302);
      });
    } else {
      app.get('/', async (request, reply) => {
        reply.type('text/html; charset=utf-8');
        return reply.code(503).send(
          '<h1>Сборка не найдена</h1><p>Выполните <code>npm run build</code>, затем запустите сервер снова.</p>',
        );
      });
    }
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Метод API не найден.',
      });
    }

    reply.type('text/plain; charset=utf-8');
    return reply.code(404).send('Страница не найдена.');
  });

  return app;
}
