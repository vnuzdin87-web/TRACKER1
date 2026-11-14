import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { ensureInitialAdmin } from './bootstrap.js';
import { createDatabase, defaultDatabaseFile } from './db.js';

dotenv.config({ quiet: true });

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const databaseFile = process.env.DB_FILE || defaultDatabaseFile;

const db = createDatabase(databaseFile);

try {
  const initialAdmin = await ensureInitialAdmin(db, {
    login: process.env.INITIAL_ADMIN_LOGIN,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  });

  if (initialAdmin) {
    console.log('');
    console.log('  ============================================================');
    console.log('   Первый администратор создан');
    console.log('  ============================================================');
    console.log(`   Логин:  ${initialAdmin.admin.login}`);
    if (initialAdmin.generated) {
      console.log(`   Пароль: ${initialAdmin.password}`);
      console.log('');
      console.log('   Сохраните пароль. При следующем запуске он не показывается.');
      console.log('   Сменить пароль: npm run admin:password -- <логин>');
    } else {
      console.log('   Пароль задан через INITIAL_ADMIN_PASSWORD.');
    }
    console.log('  ============================================================');
    console.log('');
  }

  const app = await buildApp({
    db,
    logger: { level: process.env.LOG_LEVEL || 'warn' },
    serveStatic: true,
    cookieSecure:
      process.env.COOKIE_SECURE === '1' ||
      process.env.NODE_ENV === 'production',
  });

  await app.listen({ port, host });

  console.log(`  API:        http://${host}:${port}/api/health`);
  console.log(`  Админка:    http://${host}:${port}/admin`);
  if (host === '127.0.0.1') {
    console.log(
      '  Для доступа с других устройств задайте HOST=0.0.0.0 при запуске сервера.',
    );
  }
  console.log(`  База:       ${databaseFile}`);
  console.log('');

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\nОстанавливаю сервер (${signal})…`);
    try {
      await app.close();
    } finally {
      db.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error('Не удалось запустить сервер:', error);
  db.close();
  process.exit(1);
}
