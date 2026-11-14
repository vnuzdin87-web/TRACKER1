import {
  generatePassword,
  hashPassword,
  isValidLogin,
  isValidPassword,
  normalizeLogin,
} from './auth.js';

export async function ensureInitialAdmin(
  db,
  { login, password } = {},
) {
  if (db.countAdmins() > 0) return null;

  const adminLogin = normalizeLogin(login || 'admin');
  if (!isValidLogin(adminLogin)) {
    throw new Error(
      'INITIAL_ADMIN_LOGIN должен содержать 3–32 символа: латиница, цифры, точка, дефис или подчёркивание.',
    );
  }

  const generated = typeof password !== 'string' || password.length === 0;
  const adminPassword = generated ? generatePassword(16) : password;

  if (!isValidPassword(adminPassword)) {
    throw new Error('INITIAL_ADMIN_PASSWORD должен содержать от 8 до 200 символов.');
  }

  const passwordHash = await hashPassword(adminPassword);
  const admin = db.insertAdmin({
    login: adminLogin,
    passwordHash,
  });

  return {
    admin,
    password: adminPassword,
    generated,
  };
}
