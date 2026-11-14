import { buildExportUrl, getStats } from '../api.js';
import { createAgeChart, createAveragesChart, destroyCharts } from '../charts.js';
import { LOW_DATA_THRESHOLD, PARAMS } from '../constants.js';
import {
  createEl,
  formatDate,
  formatNumber,
  formatPercent,
} from '../utils.js';
import {
  copyText,
  createChip,
  createEmptyState,
  createErrorBlock,
  createLoading,
  createTable,
} from './ui.js';

function createChartCard({
  title,
  description,
  canvasId,
  ariaLabel,
  headers,
  rows,
}) {
  const card = createEl('section', 'chart-card');
  card.innerHTML = `
    <div class="chart-card__head">
      <div>
        <h3></h3>
        <p class="muted"></p>
      </div>
    </div>
    <div class="chart-wrap">
      <canvas id="${canvasId}" role="img" aria-label="${ariaLabel}"></canvas>
    </div>
  `;

  card.querySelector('h3').textContent = title;
  card.querySelector('.muted').textContent = description;

  const details = document.createElement('details');
  details.className = 'data-table';
  const summary = document.createElement('summary');
  summary.textContent = 'Данные графика';
  details.append(summary, createTable(headers, rows));
  card.append(details);

  return card;
}

export function createOverviewView({ request, showToast }) {
  const section = createEl('section', 'admin-page');
  let disposed = false;
  let timer = null;
  let loading = false;

  section.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Результаты</p>
        <h1 tabindex="-1">Обзор</h1>
        <p class="muted">Анонимные ответы со всех устройств. Данные видны только администраторам.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn--secondary" type="button" data-refresh>Обновить</button>
        <a class="btn btn--primary" href="${buildExportUrl()}" data-export download>Экспорт CSV</a>
      </div>
    </div>

    <div class="share-box">
      <div class="share-box__text">
        <p class="share-box__title">Ссылка для участников</p>
        <p class="muted">Отправьте её респондентам. Ответы будут сохраняться на этом сервере.</p>
      </div>
      <div class="share-box__row">
        <input class="input" type="text" readonly data-share-link />
        <button class="btn btn--secondary" type="button" data-copy>Копировать</button>
      </div>
    </div>

    <div class="overview-body" aria-live="polite"></div>
  `;

  const body = section.querySelector('.overview-body');
  const refreshButton = section.querySelector('[data-refresh]');
  const exportLink = section.querySelector('[data-export]');
  const shareInput = section.querySelector('[data-share-link]');
  const copyButton = section.querySelector('[data-copy]');

  shareInput.value = `${window.location.origin}/`;

  copyButton.addEventListener('click', async () => {
    try {
      await copyText(shareInput.value);
      showToast('Ссылка скопирована');
    } catch {
      shareInput.select();
      showToast('Не удалось скопировать автоматически', 'error');
    }
  });

  exportLink.href = buildExportUrl();

  function renderEmpty() {
    const empty = createEmptyState({
      title: 'Пока нет ни одного ответа',
      text: 'Статистика появится после первой заполненной анкеты.',
    });

    const link = createEl('a', 'btn btn--primary', 'Открыть опрос');
    link.href = '/';
    empty.append(link);

    body.replaceChildren(empty);
  }

  function renderData(data) {
    if (data.count === 0) {
      renderEmpty();
      return;
    }

    const fragment = document.createDocumentFragment();
    const chips = createEl('div', 'stat-chips');
    chips.append(createChip('Ответов', String(data.count)));
    chips.append(
      createChip('Средний балл', formatNumber(data.overallAverage)),
    );
    chips.append(
      createChip(
        'Последний ответ',
        formatDate(data.lastResponseAt),
        'chip__value--date',
      ),
    );
    fragment.append(chips);

    const threshold = data.lowDataThreshold ?? LOW_DATA_THRESHOLD;
    if (data.count < threshold) {
      const notice = createEl('div', 'notice notice--info');
      notice.setAttribute('role', 'status');
      notice.textContent = `Пока мало ответов (${data.count}). Статистика ориентировочная.`;
      fragment.append(notice);
    }

    const cardsSection = createEl('section', 'stats-section');
    cardsSection.innerHTML = `
      <div class="section-heading">
        <h2>Средние по параметрам</h2>
        <p class="muted">Средняя оценка по каждому качеству из 10.</p>
      </div>
      <div class="cards"></div>
    `;

    const cards = cardsSection.querySelector('.cards');

    for (const { key, label } of PARAMS) {
      const average = data.averages?.[key] ?? 0;
      const card = createEl('article', 'card');
      card.innerHTML = `
        <p class="card__label"></p>
        <p class="card__value">
          <span class="card__number"></span>
          <span class="card__out">/ 10</span>
        </p>
        <div class="card__bar" aria-hidden="true">
          <span class="card__fill"></span>
        </div>
      `;

      card.querySelector('.card__label').textContent = label;
      card.querySelector('.card__number').textContent = formatNumber(average);
      card.querySelector('.card__fill').style.width = `${(average / 10) * 100}%`;
      cards.append(card);
    }

    fragment.append(cardsSection);

    const chartsSection = createEl('section', 'charts-section');
    chartsSection.innerHTML = `
      <div class="section-heading">
        <h2>Графики</h2>
        <p class="muted">Под каждым графиком есть таблица с теми же данными.</p>
      </div>
      <div class="charts"></div>
    `;

    const charts = chartsSection.querySelector('.charts');

    const averagesRows = PARAMS.map(({ key, label }) => [
      label,
      `${formatNumber(data.averages?.[key])} из 10`,
    ]);

    const ageRows = (data.ageDistribution ?? []).map((group) => [
      group.label,
      String(group.count),
      formatPercent(group.share),
    ]);

    charts.append(
      createChartCard({
        title: 'Средние по параметрам',
        description: 'Средняя оценка по каждому качеству, 0–10.',
        canvasId: 'chart-averages',
        ariaLabel:
          'Горизонтальная диаграмма средних оценок по пяти параметрам',
        headers: ['Параметр', 'Средняя оценка'],
        rows: averagesRows,
      }),
      createChartCard({
        title: 'Распределение по возрасту',
        description: 'Количество ответов в каждой возрастной группе.',
        canvasId: 'chart-age',
        ariaLabel:
          'Столбчатая диаграмма распределения ответов по возрастным группам',
        headers: ['Возраст', 'Ответов', 'Доля'],
        rows: ageRows,
      }),
    );

    fragment.append(chartsSection);

    const updated = createEl(
      'p',
      'updated-note',
      `Обновлено: ${formatDate(data.generatedAt)} · автообновление каждые 30 секунд`,
    );
    fragment.append(updated);

    body.replaceChildren(fragment);

    window.requestAnimationFrame(() => {
      if (disposed) return;

      createAveragesChart(
        document.getElementById('chart-averages'),
        data.averages ?? {},
      );
      createAgeChart(
        document.getElementById('chart-age'),
        data.ageDistribution ?? [],
      );
    });
  }

  async function load({ silent = false } = {}) {
    if (loading || disposed) return;
    loading = true;
    refreshButton.disabled = true;
    destroyCharts();

    if (!silent) {
      body.replaceChildren(createLoading('Загружаю статистику…'));
    }

    try {
      const data = await request(getStats);
      if (disposed) return;
      renderData(data);
      exportLink.href = buildExportUrl();
    } catch (error) {
      if (disposed) return;
      if (error?.status === 401) return;

      if (silent) {
        showToast('Не удалось обновить статистику', 'error');
      } else {
        body.replaceChildren(
          createErrorBlock(
            error?.message || 'Не удалось загрузить статистику.',
            () => load(),
          ),
        );
      }
    } finally {
      loading = false;
      if (!disposed) refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener('click', () => load());
  exportLink.addEventListener('click', () => {
    exportLink.href = buildExportUrl();
  });

  timer = window.setInterval(() => {
    if (!document.hidden) {
      load({ silent: true });
    }
  }, 30_000);

  load();

  return {
    element: section,
    destroy() {
      disposed = true;
      window.clearInterval(timer);
      destroyCharts();
    },
  };
}
