import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createDatabase, defaultDatabaseFile, projectRoot } from './db.js';

dotenv.config({ quiet: true });

const databaseFile = process.env.DB_FILE || defaultDatabaseFile;
const backupDir = process.env.BACKUP_DIR || path.join(projectRoot, 'backups');

if (!fs.existsSync(databaseFile)) {
  console.error(`База не найдена: ${databaseFile}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d+Z$/, 'Z');
const target = path.join(backupDir, `tracker-${timestamp}.sqlite`);
const db = createDatabase(databaseFile);

try {
  await db.raw.backup(target);
  const size = fs.statSync(target).size;
  console.log(`Резервная копия создана: ${target}`);
  console.log(`Размер: ${(size / 1024).toFixed(1)} КБ`);
  console.log('Для восстановления остановите сервер и замените файл базы этой копией.');
} finally {
  db.close();
}
