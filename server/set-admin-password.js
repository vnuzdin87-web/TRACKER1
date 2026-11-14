import dotenv from 'dotenv';
import {
  generatePassword,
  hashPassword,
  isValidPassword,
  normalizeLogin,
} from './auth.js';
import { createDatabase, defaultDatabaseFile } from './db.js';

dotenv.config({ quiet: true });

const [loginArg, passwordArg] = process.argv.slice(2);
const login = normalizeLogin(loginArg);

if (!login) {
  console.error(
    'Использование: npm run admin:password -- <логин> [новый пароль]',
  );
  process.exit(1);
}

const generated = !passwordArg;
const password = passwordArg || generatePassword(16);

if (!isValidPassword(password)) {
  console.error('Пароль должен содержать от 8 до 200 символов.');
  process.exit(1);
}

const db = createDatabase(process.env.DB_FILE || defaultDatabaseFile);

try {
  const admin = db.findAdminByLogin(login);
  if (!admin) {
    console.error(`Администратор «${login}» не найден.`);
    process.exitCode = 1;
  } else {
    const passwordHash = await hashPassword(password);
    db.updateAdmin(admin.id, { passwordHash });
    db.deleteAdminSessions(admin.id);
    console.log(`Пароль администратора «${admin.login}» изменён.`);
    if (generated) {
      console.log(`Новый пароль: ${password}`);
      console.log('Сохраните пароль — повторно он не показывается.');
    }
  }
} finally {
  db.close();
}
