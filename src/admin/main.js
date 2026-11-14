import '../../styles/main.css';
import '../../styles/components.css';
import '../../styles/screens.css';
import '../../styles/admin.css';

import { getMe, loginAdmin, logoutAdmin } from '../api.js';
import { createRouter } from '../router.js';
import { showToast } from '../toast.js';
import { createEl } from '../utils.js';
import { createAdminsView } from './admins.js';
import { createOverviewView } from './overview.js';
import { createResponsesView } from './responses.js';
import { createField, createInput } from './ui.js';

const ADMIN_ROUTES = {
  overview: '#/overview',
  responses: '#/responses',
  admins: '#/admins',
};

const ADMIN_TITLES = {
  [ADMIN_ROUTES.overview]: 'Обзор — админка трекера',
  [ADMIN_ROUTES.responses]: 'Ответы — админка трекера',
  [ADMIN_ROUTES.admins]: 'Администраторы — админка трекера',
};

const app = document.getElementById('admin-app');

const state = {
  admin: null,
  currentView: null,
};

let router;

function createHeader(activeRoute) {
  const header = createEl('header', 'admin-header');
  header.innerHTML = `
    <div class="admin-header__top">
      <a class="brand" href="${ADMIN_ROUTES.overview}">
        <span class="brand__mark brand__mark--dark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 4.5 4.5L19 7"></path>
          </svg>
        </span>
        <span class="brand__name">Трекер оценок · Админка</span>
      </a>
      <div class="admin-user">
        <span class="admin-user__name" data-admin-login></span>
        <button class="btn btn--secondary btn--compact" type="button" data-logout>Выйти</button>
      </div>
    </div>
    <nav class="admin-nav" aria-label="Разделы админки">
      <a class="admin-nav__link" href="${ADMIN_ROUTES.overview}" data-nav="overview">Обзор</a>
      <a class="admin-nav__link" href="${ADMIN_ROUTES.responses}" data-nav="responses">Ответы</a>
      <a class="admin-nav__link" href="${ADMIN_ROUTES.admins}" data-nav="admins">Администраторы</a>
    </nav>
  `;

  header.querySelector('[data-admin-login]').textContent =
    state.admin?.login ?? '';

  const navKey = Object.entries(ADMIN_ROUTES).find(
    ([, route]) => route === activeRoute,
  )?.[0];

  if (navKey) {
    header
      .querySelector(`[data-nav="${navKey}"]`)
      ?.setAttribute('aria-current', 'page');
  }

  header.querySelector('[data-logout]').addEventListener('click', handleLogout);

  return header;
}

function createFooter() {
  const footer = createEl('footer', 'admin-footer');
  footer.innerHTML = `
    <p>Данные доступны только администраторам</p>
    <a class="footer-link" href="/">На сайт</a>
  `;
  return footer;
}

function destroyCurrentView() {
  if (state.currentView?.destroy) {
    state.currentView.destroy();
  }
  state.currentView = null;
}

function renderLayout(view, route) {
  destroyCurrentView();
  app.innerHTML = '';
  app.append(createHeader(route));

  const main = createEl('main', 'admin-main');
  main.append(view.element);
  app.append(main);
  app.append(createFooter());

  state.currentView = view;
  document.title = ADMIN_TITLES[route] ?? ADMIN_TITLES[ADMIN_ROUTES.overview];
  focusHeading();
}

function focusHeading() {
  const heading = app.querySelector('h1');
  if (heading) heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

async function request(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.status === 401 && state.admin) {
      state.admin = null;
      destroyCurrentView();
      showToast('Сессия истекла. Войдите снова.', 'error');
      renderLogin();
    }
    throw error;
  }
}

function renderLoading() {
  app.innerHTML = `
    <main class="admin-main">
      <div class="admin-state admin-state--page" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <span>Проверяю доступ…</span>
      </div>
    </main>
  `;
}

function renderLogin() {
  destroyCurrentView();
  app.innerHTML = '';

  const section = createEl('section', 'login-page');
  section.innerHTML = `
    <div class="login-card panel">
      <div class="login-card__brand">
        <span class="brand__mark brand__mark--dark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="m5 12 4.5 4.5L19 7"></path>
          </svg>
        </span>
        <span>Трекер оценок</span>
      </div>
      <p class="eyebrow">Только для администраторов</p>
      <h1 tabindex="-1">Вход в админку</h1>
      <p class="login-card__lead">Статистика и ответы доступны после входа. Публичной регистрации нет.</p>

      <form class="login-form" novalidate>
        <div class="login-form__fields"></div>
        <p class="form-error" role="alert" hidden data-login-error></p>
        <button class="btn btn--primary btn--block" type="submit" data-login-submit>Войти</button>
      </form>

      <a class="login-card__back" href="/">Вернуться на сайт</a>
    </div>
  `;

  const form = section.querySelector('form');
  const fields = section.querySelector('.login-form__fields');
  const errorElement = section.querySelector('[data-login-error]');
  const submitButton = section.querySelector('[data-login-submit]');

  const loginInput = createInput({
    id: 'admin-login',
    name: 'login',
    autocomplete: 'username',
    placeholder: 'Логин',
    required: true,
  });

  const passwordInput = createInput({
    id: 'admin-password',
    name: 'password',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: 'Пароль',
    required: true,
  });

  fields.append(
    createField('Логин', loginInput, { forId: 'admin-login' }),
    createField('Пароль', passwordInput, { forId: 'admin-password' }),
  );

  function showError(message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorElement.hidden = true;

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (!login || !password) {
      showError('Введите логин и пароль.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Проверяю…';

    try {
      const data = await loginAdmin({ login, password });
      state.admin = data.admin;
      showToast(`Вы вошли как ${data.admin.login}`);
      passwordInput.value = '';

      const hash = window.location.hash;
      const knownRoute = Object.values(ADMIN_ROUTES).includes(hash);

      if (!knownRoute) {
        router.navigate(ADMIN_ROUTES.overview);
      } else {
        router.navigate(hash);
      }
    } catch (error) {
      if (error?.status === 429) {
        showError('Слишком много попыток входа. Подождите минуту.');
      } else {
        showError(error?.message || 'Не удалось войти.');
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Войти';
    }
  });

  app.append(section);
  document.title = 'Вход — админка трекера';
  focusHeading();
}

async function handleLogout() {
  try {
    await logoutAdmin();
    showToast('Вы вышли из админки');
  } catch (error) {
    if (error?.status !== 401) {
      showToast(error?.message || 'Не удалось завершить сессию', 'error');
    }
  } finally {
    state.admin = null;
    destroyCurrentView();
    router.navigate(ADMIN_ROUTES.overview);
    renderLogin();
  }
}

function onRoute(hash) {
  if (!state.admin) {
    renderLogin();
    return;
  }

  let route = hash;

  if (!Object.values(ADMIN_ROUTES).includes(route)) {
    router.navigate(ADMIN_ROUTES.overview);
    return;
  }

  let view;

  switch (route) {
    case ADMIN_ROUTES.responses:
      view = createResponsesView({
        request,
        showToast,
      });
      break;
    case ADMIN_ROUTES.admins:
      view = createAdminsView({
        request,
        showToast,
        currentAdmin: state.admin,
      });
      break;
    case ADMIN_ROUTES.overview:
    default:
      view = createOverviewView({ request, showToast });
      break;
  }

  renderLayout(view, route);
}

async function init() {
  if (!app) {
    console.error('[partner-eval] Не найден контейнер админки.');
    return;
  }

  renderLoading();

  try {
    const data = await getMe();
    state.admin = data.admin;
  } catch {
    state.admin = null;
  }

  router = createRouter({
    routes: {
      [ADMIN_ROUTES.overview]: true,
      [ADMIN_ROUTES.responses]: true,
      [ADMIN_ROUTES.admins]: true,
    },
    fallback: ADMIN_ROUTES.overview,
    onRoute,
  });

  router.start();
}

init();
