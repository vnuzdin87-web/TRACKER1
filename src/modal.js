import { getFocusableElements } from './utils.js';

let activeClose = null;

export function confirmModal({
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
}) {
  if (activeClose) {
    return Promise.resolve(false);
  }

  const root = document.getElementById('modal-root');
  if (!root) {
    return Promise.resolve(window.confirm(message));
  }

  const previouslyFocused = document.activeElement;
  const appRoots = Array.from(
    document.querySelectorAll('#app, #admin-app'),
  );

  root.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div class="modal__icon ${danger ? 'modal__icon--danger' : ''}" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9v4"></path>
            <path d="M12 17h.01"></path>
            <path d="M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>
          </svg>
        </div>
        <h2 class="modal__title" id="modal-title"></h2>
        <p class="modal__text" id="modal-description"></p>
        <div class="modal__actions">
          <button class="btn btn--secondary" type="button" data-modal-cancel></button>
          <button class="btn btn--danger-solid" type="button" data-modal-confirm></button>
        </div>
      </div>
    </div>
  `;

  const backdrop = root.querySelector('[data-modal-backdrop]');
  const dialog = root.querySelector('[role="dialog"]');
  const titleElement = root.querySelector('#modal-title');
  const descriptionElement = root.querySelector('#modal-description');
  const cancelButton = root.querySelector('[data-modal-cancel]');
  const confirmButton = root.querySelector('[data-modal-confirm]');

  titleElement.textContent = title;
  descriptionElement.textContent = message;
  cancelButton.textContent = cancelLabel;
  confirmButton.textContent = confirmLabel;

  document.body.classList.add('modal-open');
  for (const rootElement of appRoots) {
    rootElement.setAttribute('inert', '');
    rootElement.setAttribute('aria-hidden', 'true');
  }

  return new Promise((resolve) => {
    let closed = false;

    function close(result) {
      if (closed) return;
      closed = true;

      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
      for (const rootElement of appRoots) {
        rootElement.removeAttribute('inert');
        rootElement.removeAttribute('aria-hidden');
      }
      root.innerHTML = '';
      activeClose = null;

      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }

      resolve(result);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    activeClose = close;

    cancelButton.addEventListener('click', () => close(false));
    confirmButton.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener('keydown', handleKeyDown);

    cancelButton.focus();
  });
}

export function promptModal({
  title,
  message,
  label = 'Значение',
  type = 'text',
  placeholder = '',
  confirmLabel = 'Сохранить',
  cancelLabel = 'Отмена',
  minLength = 0,
  autocomplete = 'off',
  hint = '',
}) {
  if (activeClose) {
    return Promise.resolve(null);
  }

  const root = document.getElementById('modal-root');
  if (!root) {
    return Promise.resolve(window.prompt(message || title));
  }

  const previouslyFocused = document.activeElement;
  const appRoots = Array.from(
    document.querySelectorAll('#app, #admin-app'),
  );

  root.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <form
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        novalidate
      >
        <div class="modal__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="10" width="16" height="11" rx="2"></rect>
            <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
          </svg>
        </div>
        <h2 class="modal__title" id="modal-title"></h2>
        <p class="modal__text" id="modal-description"></p>
        <label class="modal__label" for="modal-input"></label>
        <input class="input modal__input" id="modal-input" type="${type}" autocomplete="${autocomplete}" />
        <p class="modal__hint"></p>
        <p class="modal__error" role="alert" hidden></p>
        <div class="modal__actions">
          <button class="btn btn--secondary" type="button" data-modal-cancel></button>
          <button class="btn btn--primary" type="submit" data-modal-confirm></button>
        </div>
      </form>
    </div>
  `;

  const backdrop = root.querySelector('[data-modal-backdrop]');
  const dialog = root.querySelector('[role="dialog"]');
  const titleElement = root.querySelector('#modal-title');
  const descriptionElement = root.querySelector('#modal-description');
  const labelElement = root.querySelector('.modal__label');
  const hintElement = root.querySelector('.modal__hint');
  const errorElement = root.querySelector('.modal__error');
  const input = root.querySelector('#modal-input');
  const cancelButton = root.querySelector('[data-modal-cancel]');
  const confirmButton = root.querySelector('[data-modal-confirm]');

  titleElement.textContent = title;
  descriptionElement.textContent = message || '';
  labelElement.textContent = label;
  hintElement.textContent = hint;
  hintElement.hidden = !hint;
  cancelButton.textContent = cancelLabel;
  confirmButton.textContent = confirmLabel;
  input.placeholder = placeholder;

  if (minLength > 0) {
    input.minLength = minLength;
    input.required = true;
  }

  document.body.classList.add('modal-open');
  for (const rootElement of appRoots) {
    rootElement.setAttribute('inert', '');
    rootElement.setAttribute('aria-hidden', 'true');
  }

  return new Promise((resolve) => {
    let closed = false;

    function close(result) {
      if (closed) return;
      closed = true;

      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
      for (const rootElement of appRoots) {
        rootElement.removeAttribute('inert');
        rootElement.removeAttribute('aria-hidden');
      }
      root.innerHTML = '';
      activeClose = null;

      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }

      resolve(result);
    }

    function showError(message) {
      errorElement.textContent = message;
      errorElement.hidden = false;
      input.focus();
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleSubmit(event) {
      event.preventDefault();
      const value = input.value;

      if (value.length < minLength) {
        showError(`Введите не менее ${minLength} символов.`);
        return;
      }

      close(value);
    }

    activeClose = close;

    dialog.addEventListener('submit', handleSubmit);
    cancelButton.addEventListener('click', () => close(null));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(null);
    });
    document.addEventListener('keydown', handleKeyDown);

    input.focus();
  });
}
