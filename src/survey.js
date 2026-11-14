import {
  AGE_GROUPS,
  DEFAULT_SCORE,
  GENDERS,
  MAX_SCORE,
  MIN_SCORE,
  PARAMS,
} from './constants.js';
import { validateResponse } from './validation.js';

function renderRating(param) {
  return `
    <div class="rating" data-rating="${param.key}">
      <div class="rating__head">
        <label class="rating__label" for="score-${param.key}">${param.label}</label>
        <output class="rating__value" id="value-${param.key}" for="score-${param.key}" aria-hidden="true">${DEFAULT_SCORE}</output>
      </div>
      <p class="rating__hint" id="hint-${param.key}">${param.hint}</p>
      <input
        class="range"
        type="range"
        id="score-${param.key}"
        name="${param.key}"
        min="${MIN_SCORE}"
        max="${MAX_SCORE}"
        step="1"
        value="${DEFAULT_SCORE}"
        aria-describedby="hint-${param.key} scale-${param.key} error-score-${param.key}"
      />
      <div class="rating__scale" id="scale-${param.key}">
        <span>1 — низкая</span>
        <span>10 — высокая</span>
      </div>
      <p class="field__error rating__error" id="error-score-${param.key}" role="alert" hidden></p>
    </div>
  `;
}

function renderRadioGroup({ name, label, options }) {
  return `
    <fieldset
      class="field"
      data-field="${name}"
      aria-describedby="error-${name}"
      aria-required="true"
      aria-invalid="false"
    >
      <legend class="field__legend">${label}</legend>
      <div class="segmented">
        ${options
          .map(
            (option) => `
              <label class="segmented__option">
                <input type="radio" name="${name}" value="${option.value}" />
                <span>${option.label}</span>
              </label>
            `,
          )
          .join('')}
      </div>
      <p class="field__error" id="error-${name}" role="alert" hidden></p>
    </fieldset>
  `;
}

export function createSurveyView({ onSubmit }) {
  const section = document.createElement('section');
  section.className = 'survey panel';

  section.innerHTML = `
    <form class="survey__form" novalidate>
      <div class="survey__head">
        <p class="eyebrow">Анонимный опрос</p>
        <h1 id="survey-title" tabindex="-1">Оцените партнёра</h1>
        <p class="survey__lead">Оцените каждое качество по шкале от 1 до 10.</p>
      </div>

      <div class="ratings">
        ${PARAMS.map(renderRating).join('')}
      </div>

      <div class="demographics">
        ${renderRadioGroup({ name: 'gender', label: 'Пол', options: GENDERS })}
        ${renderRadioGroup({
          name: 'ageGroup',
          label: 'Возраст',
          options: AGE_GROUPS,
        })}
      </div>

      <div class="survey__submit">
        <button class="btn btn--primary btn--block" type="submit">
          Отправить оценку
        </button>
        <p class="form-note">Ответы отправляются на сервер анонимно и доступны только администраторам.</p>
        <p class="form-error" role="alert" hidden></p>
      </div>
    </form>
  `;

  const form = section.querySelector('form');
  const submitButton = form.querySelector('button[type="submit"]');
  const formError = form.querySelector('.form-error');

  let attempted = false;
  let submitting = false;

  function updateRange(input) {
    const value = Number(input.value);
    const progress = ((value - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100;
    const output = form.querySelector(`#value-${input.name}`);

    input.style.setProperty('--range-progress', `${progress}%`);
    input.setAttribute('aria-valuetext', `${value} из 10`);

    if (output) {
      output.textContent = String(value);
    }
  }

  function readForm() {
    const data = new FormData(form);
    const gender = data.get('gender');
    const ageGroup = data.get('ageGroup');
    const scores = {};

    for (const { key } of PARAMS) {
      scores[key] = Number(form.querySelector(`#score-${key}`).value);
    }

    return {
      gender: typeof gender === 'string' ? gender : '',
      ageGroup: typeof ageGroup === 'string' ? ageGroup : '',
      scores,
    };
  }

  function setFieldError(name, message) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) return;

    const error = field.querySelector('.field__error');
    field.classList.add('field--invalid');
    field.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
  }

  function clearFieldError(name) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) return;

    const error = field.querySelector('.field__error');
    field.classList.remove('field--invalid');
    field.setAttribute('aria-invalid', 'false');
    error.textContent = '';
    error.hidden = true;
  }

  function setScoreError(key, message) {
    const rating = form.querySelector(`[data-rating="${key}"]`);
    if (!rating) return;

    const input = rating.querySelector('input[type="range"]');
    const error = rating.querySelector('.field__error');
    rating.classList.add('rating--invalid');
    input.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
  }

  function clearScoreError(key) {
    const rating = form.querySelector(`[data-rating="${key}"]`);
    if (!rating) return;

    const input = rating.querySelector('input[type="range"]');
    const error = rating.querySelector('.field__error');
    rating.classList.remove('rating--invalid');
    input.setAttribute('aria-invalid', 'false');
    error.textContent = '';
    error.hidden = true;
  }

  function clearErrors() {
    clearFieldError('gender');
    clearFieldError('ageGroup');
    for (const { key } of PARAMS) {
      clearScoreError(key);
    }
  }

  function showErrors(errors) {
    clearErrors();

    if (errors.gender) setFieldError('gender', errors.gender);
    if (errors.ageGroup) setFieldError('ageGroup', errors.ageGroup);

    for (const { key } of PARAMS) {
      const message = errors[`scores.${key}`];
      if (message) setScoreError(key, message);
    }
  }

  function focusFirstError(errors) {
    if (errors.gender) {
      form.querySelector('input[name="gender"]')?.focus();
      return;
    }

    if (errors.ageGroup) {
      form.querySelector('input[name="ageGroup"]')?.focus();
      return;
    }

    for (const { key } of PARAMS) {
      if (errors[`scores.${key}`]) {
        form.querySelector(`#score-${key}`)?.focus();
        return;
      }
    }
  }

  function clearFormError() {
    formError.textContent = '';
    formError.hidden = true;
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  for (const { key } of PARAMS) {
    const input = form.querySelector(`#score-${key}`);
    updateRange(input);
    input.addEventListener('input', () => updateRange(input));
  }

  for (const input of form.querySelectorAll('input[type="radio"]')) {
    input.addEventListener('change', () => {
      clearFormError();
      if (!attempted) return;

      const { errors } = validateResponse(readForm());

      if (errors.gender) {
        setFieldError('gender', errors.gender);
      } else {
        clearFieldError('gender');
      }

      if (errors.ageGroup) {
        setFieldError('ageGroup', errors.ageGroup);
      } else {
        clearFieldError('ageGroup');
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    clearFormError();

    const data = readForm();
    const { valid, errors } = validateResponse(data);

    if (!valid) {
      attempted = true;
      showErrors(errors);
      focusFirstError(errors);
      return;
    }

    showErrors({});
    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Сохраняем…';
    form.setAttribute('aria-busy', 'true');

    try {
      const result = await onSubmit(data);

      if (result && result.ok === false) {
        submitting = false;
        submitButton.disabled = false;
        submitButton.textContent = 'Отправить оценку';
        form.removeAttribute('aria-busy');
        showFormError(
          result.message || 'Не удалось отправить ответ. Попробуйте ещё раз.',
        );
        return;
      }

      // Успешная отправка сразу уводит на #/done. Кнопку не разблокируем,
      // чтобы повторный клик до смены маршрута не создал дубликат.
    } catch (error) {
      console.error('[partner-eval] Ошибка отправки формы:', error);
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Отправить оценку';
      form.removeAttribute('aria-busy');
      showFormError(
        error?.message || 'Не удалось отправить ответ. Попробуйте ещё раз.',
      );
    }
  });

  return section;
}
