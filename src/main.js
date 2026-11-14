import '../styles/main.css';
import '../styles/components.css';
import '../styles/screens.css';

import { submitResponse } from './api.js';
import { ADMIN_PATH, PAGE_TITLES, ROUTES } from './constants.js';
import { createRouter } from './router.js';
import { createSurveyView } from './survey.js';
import { createEl } from './utils.js';

const ICONS = {
  check: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7"></path>
    </svg>
  `,
  lock: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
    </svg>
  `,
};

const app = document.getElementById('app');
const appState = {
  justSubmitted: false,
};

let router;
let routeToken = 0;

function createHeader(activeRoute) {
  const header = createEl('header', 'app-header');
  const isFormRoute = activeRoute === ROUTES.survey || activeRoute === ROUTES.done;

  header.innerHTML = `
    <a class="brand" href="${ROUTES.start}" aria-label="Трекер оценок — на главную">
      <span class="brand__mark" aria-hidden="true">${ICONS.check}</span>
      <span class="brand__name">Трекер оценок</span>
    </a>
    <nav class="app-nav" aria-label="Основная навигация">
      <a class="nav-link" href="${isFormRoute ? ROUTES.start : ADMIN_PATH}">
        ${isFormRoute ? 'На главную' : 'Вход для администратора'}
      </a>
    </nav>
  `;

  return header;
}

function createFooter() {
  const footer = createEl('footer', 'app-footer');
  footer.innerHTML = `
    <p>Анонимно · ответы сохраняются на сервере</p>
    <a class="footer-link" href="${ADMIN_PATH}">Вход для администратора</a>
  `;
  return footer;
}

function renderLayout(view, route) {
  app.innerHTML = '';
  app.append(createHeader(route));

  const main = createEl('main', 'app-main');
  main.append(view);
  app.append(main);

  app.append(createFooter(route));
}

function renderStart() {
  const section = createEl('section', 'hero');

  section.innerHTML = `
    <p class="eyebrow">Маркетинговое исследование</p>
    <h1 tabindex="-1">Оценка партнёра</h1>
    <p class="hero__subtitle">Анонимный опрос для маркетингового исследования</p>
    <p class="hero__lead">5 качеств, шкала от 1 до 10 и два вопроса о себе. Займёт 1–2 минуты. Пройти опрос можно с любого устройства по этой ссылке.</p>

    <ul class="hero__meta" aria-label="Параметры опроса">
      <li>5 качеств</li>
      <li>шкала 1–10</li>
      <li>1–2 минуты</li>
    </ul>

    <div class="privacy">
      <span class="privacy__icon" aria-hidden="true">${ICONS.lock}</span>
      <div class="privacy__body">
        <p class="privacy__title">Полная анонимность</p>
        <p>Мы не спрашиваем имя и контакты, не сохраняем IP и не используем стороннюю аналитику. Ответы отправляются на защищённый сервер и доступны только администраторам.</p>
      </div>
    </div>

    <div class="hero__actions">
      <a class="btn btn--primary" href="${ROUTES.survey}">Начать опрос</a>
    </div>

    <p class="hero__footnote">Результаты опроса не показываются участникам.</p>
  `;

  return section;
}

function renderDone() {
  const section = createEl('section', 'done panel');

  section.innerHTML = `
    <div class="done__icon" aria-hidden="true">${ICONS.check}</div>
    <p class="eyebrow">Ответ отправлен</p>
    <h1 tabindex="-1">Спасибо!</h1>
    <p class="done__text">Ответ сохранён анонимно на сервере. Спасибо за участие — вы можете закрыть эту страницу.</p>

    <div class="done__actions">
      <a class="btn btn--primary" href="${ROUTES.start}">На главную</a>
      <a class="btn btn--secondary" href="${ROUTES.survey}">Пройти ещё раз</a>
    </div>

    <p class="done__note">${ICONS.lock} Имя, контакты и IP не сохранялись</p>
  `;

  return section;
}

function focusHeading() {
  const heading = app.querySelector('h1');
  if (heading) {
    heading.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

async function handleSubmit(data) {
  try {
    await submitResponse(data);
    appState.justSubmitted = true;
    router.navigate(ROUTES.done);
    return { ok: true };
  } catch (error) {
    if (error?.status === 429) {
      return {
        ok: false,
        message:
          'Слишком много ответов с этого устройства. Подождите минуту и попробуйте снова.',
      };
    }

    if (error?.status === 400) {
      return {
        ok: false,
        message:
          error.message || 'Сервер не принял ответ. Проверьте заполнение формы.',
      };
    }

    return {
      ok: false,
      message:
        'Не удалось отправить ответ. Проверьте подключение к интернету и попробуйте ещё раз.',
    };
  }
}

function onRoute(hash) {
  const token = ++routeToken;

  if (hash === ROUTES.stats) {
    window.location.replace(ADMIN_PATH);
    return;
  }

  if (hash === ROUTES.done && !appState.justSubmitted) {
    router.navigate(ROUTES.start);
    return;
  }

  if (hash === ROUTES.survey) {
    appState.justSubmitted = false;
  }

  let view;

  switch (hash) {
    case ROUTES.survey:
      view = createSurveyView({ onSubmit: handleSubmit });
      break;
    case ROUTES.done:
      view = renderDone();
      break;
    case ROUTES.start:
    default:
      view = renderStart();
      break;
  }

  renderLayout(view, hash);
  document.title = PAGE_TITLES[hash] ?? PAGE_TITLES[ROUTES.start];
  focusHeading();

  if (token !== routeToken) return;
}

function init() {
  if (!app) {
    console.error('[partner-eval] Не найден контейнер приложения.');
    return;
  }

  router = createRouter({
    routes: {
      [ROUTES.start]: true,
      [ROUTES.survey]: true,
      [ROUTES.done]: true,
    },
    fallback: ROUTES.start,
    onRoute,
  });

  router.start();
}

init();
