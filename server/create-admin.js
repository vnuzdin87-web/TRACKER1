import dotenv from 'dotenv';
import {
  generatePassword,
  hashPassword,
  isValidLogin,
  isValidPassword,
  normalizeLogin,
} from './auth.js';
import { createDatabase, defaultDatabaseFile } from './db.js';

dotenv.config({ quiet: true });

const [loginArg, passwordArg] = process.argv.slice(2);
const login = normalizeLogin(loginArg);

if (!isValidLogin(login)) {
  console.error(
    'Использование: npm run admin:create -- <логин> [пароль]\n' +
      'Логин: 3–32 символа, латинские буквы, цифры, точка, дефис или подчёркивание.',
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
  if (db.findAdminByLogin(login)) {
    console.error(
      `Администратор «${login}» уже существует. Сменить пароль: npm run admin:password -- ${login}`,
    );
    process.exitCode = 1;
  } else {
    const passwordHash = await hashPassword(password);
    const admin = db.insertAdmin({ login, passwordHash });
    console.log(`Администратор «${admin.login}» создан.`);
    if (generated) {
      console.log(`Пароль: ${password}`);
      console.log('Сохраните пароль — повторно он не показывается.');
    }
  }
} finally {
  db.close();
}
