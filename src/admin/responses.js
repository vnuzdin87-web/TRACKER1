import {
  buildExportUrl,
  deleteAllResponses,
  getResponses,
} from '../api.js';
import { AGE_GROUPS, GENDERS, PARAMS } from '../constants.js';
import { confirmModal } from '../modal.js';
import { getResponseAverage } from '../stats.js';
import {
  formatDate,
  formatNumber,
  formatResponses,
} from '../utils.js';
import { createEl } from '../utils.js';
import {
  ageLabel,
  createEmptyState,
  createErrorBlock,
  createField,
  createInput,
  createLoading,
  createSelect,
  createTable,
  genderLabel,
} from './ui.js';

export function createResponsesView({ request, showToast }) {
  const section = createEl('section', 'admin-page');
  let disposed = false;
  let loading = false;
  let filters = {};
  let limit = 50;
  let offset = 0;
  let total = 0;

  section.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Данные</p>
        <h1 tabindex="-1">Ответы</h1>
        <p class="muted">Все ответы сохраняются в центральной базе. Фильтры действуют на таблицу и экспорт.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn--secondary" type="button" data-refresh>Обновить</button>
        <a class="btn btn--primary" href="${buildExportUrl()}" data-export download>Экспорт CSV</a>
        <button class="btn btn--danger" type="button" data-delete-all>Очистить все</button>
      </div>
    </div>

    <form class="filters panel" data-filters>
      <div class="filters__grid"></div>
      <div class="filters__actions">
        <button class="btn btn--primary" type="submit">Применить</button>
        <button class="btn btn--secondary" type="button" data-reset>Сбросить</button>
      </div>
    </form>

    <div class="responses-summary" data-summary></div>
    <div class="responses-body" aria-live="polite"></div>
    <div class="pagination" data-pagination hidden></div>
  `;

  const filterForm = section.querySelector('[data-filters]');
  const filtersGrid = section.querySelector('.filters__grid');
  const summary = section.querySelector('[data-summary]');
  const body = section.querySelector('.responses-body');
  const pagination = section.querySelector('[data-pagination]');
  const refreshButton = section.querySelector('[data-refresh]');
  const exportLink = section.querySelector('[data-export]');
  const deleteButton = section.querySelector('[data-delete-all]');

  const genderSelect = createSelect({
    id: 'filter-gender',
    name: 'gender',
    options: [
      { value: '', label: 'Все' },
      ...GENDERS.map(({ value, label }) => ({
        value,
        label: label === 'М' ? 'Мужской' : 'Женский',
      })),
    ],
  });

  const ageSelect = createSelect({
    id: 'filter-age',
    name: 'ageGroup',
    options: [
      { value: '', label: 'Все' },
      ...AGE_GROUPS.map(({ value, label }) => ({ value, label })),
    ],
  });

  const fromInput = createInput({ id: 'filter-from', name: 'from', type: 'date' });
  const toInput = createInput({ id: 'filter-to', name: 'to', type: 'date' });

  filtersGrid.append(
    createField('Пол', genderSelect, { forId: 'filter-gender' }),
    createField('Возраст', ageSelect, { forId: 'filter-age' }),
    createField('С даты', fromInput, { forId: 'filter-from' }),
    createField('По дату', toInput, { forId: 'filter-to' }),
  );

  function collectFilters() {
    const data = new FormData(filterForm);
    const next = {};

    for (const key of ['gender', 'ageGroup', 'from', 'to']) {
      const value = data.get(key);
      if (typeof value === 'string' && value.trim() !== '') {
        next[key] = value;
      }
    }

    return next;
  }

  function updateExportLink() {
    exportLink.href = buildExportUrl(filters);
  }

  function renderPagination() {
    pagination.replaceChildren();

    if (total <= limit) {
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.floor(offset / limit) + 1;

    const prev = createEl('button', 'btn btn--secondary', 'Назад');
    prev.type = 'button';
    prev.disabled = offset === 0;
    prev.addEventListener('click', () => {
      offset = Math.max(0, offset - limit);
      load();
    });

    const next = createEl('button', 'btn btn--secondary', 'Вперёд');
    next.type = 'button';
    next.disabled = offset + limit >= total;
    next.addEventListener('click', () => {
      offset += limit;
      load();
    });

    pagination.append(
      prev,
      createEl('span', 'pagination__info', `Страница ${page} из ${pages}`),
      next,
    );
  }

  function renderItems(data) {
    if (data.items.length === 0) {
      summary.textContent =
        data.total === 0
          ? 'Ответов по выбранным фильтрам нет.'
          : `Найдено ${formatResponses(data.total)}.`;
      body.replaceChildren(
        createEmptyState({
          title: 'Ничего не найдено',
          text: 'Измените фильтры или сбросьте их, чтобы увидеть все ответы.',
        }),
      );
      return;
    }

    summary.textContent = `Найдено ${formatResponses(data.total)} · показаны ${data.offset + 1}–${Math.min(
      data.offset + data.items.length,
      data.total,
    )}`;

    const rows = data.items.map((response) => [
      formatDate(response.createdAt),
      genderLabel(response.gender),
      ageLabel(response.ageGroup),
      ...PARAMS.map(({ key }) => String(response.scores[key])),
      formatNumber(getResponseAverage(response)),
    ]);

    body.replaceChildren(
      createTable(
        [
          'Дата и время',
          'Пол',
          'Возраст',
          ...PARAMS.map(({ label }) => label),
          'Средний балл',
        ],
        rows,
        { tableClass: 'table--responses' },
      ),
    );
  }

  async function load() {
    if (loading || disposed) return;
    loading = true;
    refreshButton.disabled = true;
    deleteButton.disabled = true;
    body.replaceChildren(createLoading('Загружаю ответы…'));

    try {
      const data = await request(() =>
        getResponses({ ...filters, limit, offset }),
      );

      if (disposed) return;
      total = data.total;
      renderItems(data);
      renderPagination();
      updateExportLink();
      deleteButton.disabled = total === 0;
    } catch (error) {
      if (disposed) return;
      if (error?.status === 401) return;

      summary.textContent = '';
      pagination.hidden = true;
      body.replaceChildren(
        createErrorBlock(
          error?.message || 'Не удалось загрузить ответы.',
          () => load(),
        ),
      );
    } finally {
      loading = false;
      if (!disposed) {
        refreshButton.disabled = false;
        deleteButton.disabled = total === 0;
      }
    }
  }

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    filters = collectFilters();
    offset = 0;
    load();
  });

  section.querySelector('[data-reset]').addEventListener('click', () => {
    filterForm.reset();
    filters = {};
    offset = 0;
    load();
  });

  refreshButton.addEventListener('click', () => load());

  exportLink.addEventListener('click', () => {
    updateExportLink();
  });

  deleteButton.addEventListener('click', async () => {
    const confirmed = await confirmModal({
      title: 'Удалить все ответы?',
      message:
        'Будут удалены все ответы из базы, включая скрытые фильтрами. Это действие нельзя отменить.',
      confirmLabel: 'Удалить всё',
      cancelLabel: 'Отмена',
    });

    if (!confirmed) return;

    try {
      const result = await request(deleteAllResponses);
      offset = 0;
      showToast(`Удалено: ${formatResponses(result.deleted)}`);
      await load();
    } catch (error) {
      if (error?.status === 401) return;
      showToast(error?.message || 'Не удалось удалить ответы', 'error');
    }
  });

  load();

  return {
    element: section,
    destroy() {
      disposed = true;
    },
  };
}
