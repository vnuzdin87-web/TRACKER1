import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverDir, '..');
export const defaultDatabaseFile = path.join(
  projectRoot,
  'data',
  'tracker.sqlite',
);

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_admin_id
    ON sessions(admin_id);

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('m', 'f')),
    age_group TEXT NOT NULL CHECK (age_group IN ('under25', '25to35', 'over35')),
    confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 10),
    sensitivity INTEGER NOT NULL CHECK (sensitivity BETWEEN 1 AND 10),
    initiative INTEGER NOT NULL CHECK (initiative BETWEEN 1 AND 10),
    adaptability INTEGER NOT NULL CHECK (adaptability BETWEEN 1 AND 10),
    overall INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 10)
  );

  CREATE INDEX IF NOT EXISTS idx_responses_created_at
    ON responses(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_responses_age_group
    ON responses(age_group);
`;

function mapResponse(row) {
  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.created_at,
    gender: row.gender,
    ageGroup: row.age_group,
    scores: {
      confidence: row.confidence,
      sensitivity: row.sensitivity,
      initiative: row.initiative,
      adaptability: row.adaptability,
      overall: row.overall,
    },
  };
}

function mapAdmin(row) {
  if (!row) return null;

  return {
    id: row.id,
    login: row.login,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
  };
}

function buildResponseFilter(filters = {}) {
  const clauses = [];
  const params = {};

  if (filters.gender) {
    clauses.push('gender = @gender');
    params.gender = filters.gender;
  }

  if (filters.ageGroup) {
    clauses.push('age_group = @ageGroup');
    params.ageGroup = filters.ageGroup;
  }

  if (filters.from) {
    clauses.push('created_at >= @from');
    params.from = filters.from;
  }

  if (filters.to) {
    clauses.push('created_at <= @to');
    params.to = filters.to;
  }

  return {
    where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function createDatabase(filename = defaultDatabaseFile) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);

  function insertResponse(response) {
    db.prepare(
      `
        INSERT INTO responses (
          id, created_at, gender, age_group,
          confidence, sensitivity, initiative, adaptability, overall
        ) VALUES (
          @id, @createdAt, @gender, @ageGroup,
          @confidence, @sensitivity, @initiative, @adaptability, @overall
        )
      `,
    ).run({
      id: response.id,
      createdAt: response.createdAt,
      gender: response.gender,
      ageGroup: response.ageGroup,
      confidence: response.scores.confidence,
      sensitivity: response.scores.sensitivity,
      initiative: response.scores.initiative,
      adaptability: response.scores.adaptability,
      overall: response.scores.overall,
    });

    return response;
  }

  function getResponse(id) {
    return mapResponse(
      db.prepare('SELECT * FROM responses WHERE id = ?').get(id),
    );
  }

  function listResponses({ limit = 50, offset = 0, ...filters } = {}) {
    const { where, params } = buildResponseFilter(filters);
    const total = db
      .prepare(`SELECT COUNT(*) AS count FROM responses${where}`)
      .get(params).count;

    const rows = db
      .prepare(
        `SELECT * FROM responses${where}
         ORDER BY created_at DESC, id DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset });

    return {
      items: rows.map(mapResponse),
      total,
      limit,
      offset,
    };
  }

  function listAllResponses(filters = {}) {
    const { where, params } = buildResponseFilter(filters);
    return db
      .prepare(
        `SELECT * FROM responses${where}
         ORDER BY created_at DESC, id DESC`,
      )
      .all(params)
      .map(mapResponse);
  }

  function countResponses() {
    return db.prepare('SELECT COUNT(*) AS count FROM responses').get().count;
  }

  function deleteAllResponses() {
    return db.prepare('DELETE FROM responses').run().changes;
  }

  function countAdmins() {
    return db.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
  }

  function countActiveAdmins() {
    return db
      .prepare('SELECT COUNT(*) AS count FROM admins WHERE is_active = 1')
      .get().count;
  }

  function getAdmin(id) {
    return mapAdmin(db.prepare('SELECT * FROM admins WHERE id = ?').get(id));
  }

  function findAdminByLogin(login) {
    return db
      .prepare('SELECT * FROM admins WHERE login = ? COLLATE NOCASE')
      .get(login);
  }

  function findAdminById(id) {
    return db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
  }

  function listAdmins() {
    return db
      .prepare('SELECT * FROM admins ORDER BY created_at ASC, login ASC')
      .all()
      .map(mapAdmin);
  }

  function insertAdmin({ login, passwordHash }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO admins (id, login, password_hash, is_active, created_at)
       VALUES (?, ?, ?, 1, ?)`,
    ).run(id, login, passwordHash, createdAt);

    return getAdmin(id);
  }

  function updateAdmin(id, { isActive, passwordHash } = {}) {
    const clauses = [];
    const params = { id };

    if (typeof isActive === 'boolean') {
      clauses.push('is_active = @isActive');
      params.isActive = isActive ? 1 : 0;
    }

    if (typeof passwordHash === 'string') {
      clauses.push('password_hash = @passwordHash');
      params.passwordHash = passwordHash;
    }

    if (clauses.length === 0) return getAdmin(id);

    db.prepare(`UPDATE admins SET ${clauses.join(', ')} WHERE id = @id`).run(
      params,
    );

    return getAdmin(id);
  }

  function setAdminLastLogin(id, isoDate) {
    db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(
      isoDate,
      id,
    );
  }

  function createSession({ tokenHash, adminId, createdAt, expiresAt }) {
    db.prepare(
      `INSERT INTO sessions (token_hash, admin_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).run(tokenHash, adminId, createdAt, expiresAt);
  }

  function findSession(tokenHash) {
    return db
      .prepare(
        `SELECT
           s.token_hash,
           s.admin_id,
           s.created_at AS session_created_at,
           s.expires_at,
           a.id,
           a.login,
           a.is_active,
           a.created_at,
           a.last_login_at
         FROM sessions s
         JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = ?`,
      )
      .get(tokenHash);
  }

  function deleteSession(tokenHash) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  function deleteAdminSessions(adminId) {
    db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(adminId);
  }

  function deleteAdminSessionsExcept(adminId, tokenHash) {
    db.prepare(
      'DELETE FROM sessions WHERE admin_id = ? AND token_hash <> ?',
    ).run(adminId, tokenHash);
  }

  function deleteExpiredSessions(now = new Date().toISOString()) {
    return db
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .run(now).changes;
  }

  return {
    raw: db,
    close: () => db.close(),
    insertResponse,
    getResponse,
    listResponses,
    listAllResponses,
    countResponses,
    deleteAllResponses,
    countAdmins,
    countActiveAdmins,
    getAdmin,
    findAdminByLogin,
    findAdminById,
    listAdmins,
    insertAdmin,
    updateAdmin,
    setAdminLastLogin,
    createSession,
    findSession,
    deleteSession,
    deleteAdminSessions,
    deleteAdminSessionsExcept,
    deleteExpiredSessions,
  };
}
