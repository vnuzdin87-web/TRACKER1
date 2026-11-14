import { AGE_GROUPS, GENDERS } from '../constants.js';
import { createEl } from '../utils.js';

export function genderLabel(value) {
  return GENDERS.find((item) => item.value === value)?.label ?? value ?? '—';
}

export function ageLabel(value) {
  return AGE_GROUPS.find((item) => item.value === value)?.label ?? value ?? '—';
}

export function createChip(label, value, valueClass = '') {
  const chip = createEl('div', 'chip');
  const labelElement = createEl('span', 'chip__label', label);
  const valueElement = createEl(
    'span',
    `chip__value${valueClass ? ` ${valueClass}` : ''}`,
    value,
  );

  chip.append(labelElement, valueElement);
  return chip;
}

export function createTable(headers, rows, { tableClass = '' } = {}) {
  const wrapper = createEl('div', 'table-wrap');
  const table = createEl(
    'table',
    `table${tableClass ? ` ${tableClass}` : ''}`,
  );

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  for (const header of headers) {
    const th = createEl('th', '', header);
    th.scope = 'col';
    headRow.append(th);
  }

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');

  for (const row of rows) {
    const tr = document.createElement('tr');

    for (const cell of row) {
      const td = createEl('td');
      if (cell instanceof Node) {
        td.append(cell);
      } else {
        td.textContent = cell === null || cell === undefined ? '—' : String(cell);
      }
      tr.append(td);
    }

    tbody.append(tr);
  }

  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}

export function createLoading(text = 'Загрузка данных…') {
  const element = createEl('div', 'admin-state');
  element.setAttribute('role', 'status');
  element.innerHTML = `
    <span class="spinner" aria-hidden="true"></span>
    <span></span>
  `;
  element.querySelector('span:last-child').textContent = text;
  return element;
}

export function createErrorBlock(message, onRetry) {
  const element = createEl('div', 'admin-state admin-state--error');
  element.setAttribute('role', 'alert');

  const text = createEl('p', 'admin-state__text', message);
  element.append(text);

  if (onRetry) {
    const retry = createEl('button', 'btn btn--secondary', 'Повторить');
    retry.type = 'button';
    retry.addEventListener('click', onRetry);
    element.append(retry);
  }

  return element;
}

export function createEmptyState({ title, text, action } = {}) {
  const element = createEl('div', 'admin-empty');
  const heading = createEl('h2', '', title || 'Данных пока нет');
  const description = createEl('p', '', text || '');

  element.append(heading);
  if (text) element.append(description);
  if (action) element.append(action);

  return element;
}

export function createBadge(text, type = 'neutral') {
  return createEl('span', `badge badge--${type}`, text);
}

export function createInput({
  id,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  autocomplete = 'off',
  required = false,
  minLength,
}) {
  const input = document.createElement('input');
  input.className = 'input';
  input.id = id;
  input.name = name || id;
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = autocomplete;

  if (required) input.required = true;
  if (minLength) input.minLength = minLength;

  return input;
}

export function createSelect({ id, name, options }) {
  const select = document.createElement('select');
  select.className = 'input';
  select.id = id;
  select.name = name || id;

  for (const option of options) {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    select.append(item);
  }

  return select;
}

export function createField(labelText, control, { hint, forId } = {}) {
  const field = createEl('label', 'form-field');
  const label = createEl('span', 'form-field__label', labelText);

  if (forId) {
    field.htmlFor = forId;
  }

  field.append(label, control);

  if (hint) {
    field.append(createEl('span', 'form-field__hint', hint));
  }

  return field;
}

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}
