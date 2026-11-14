import { createAdmin, getAdmins, updateAdmin } from '../api.js';
import { confirmModal, promptModal } from '../modal.js';
import { createEl, formatDate } from '../utils.js';
import {
  createBadge,
  createEmptyState,
  createErrorBlock,
  createField,
  createInput,
  createLoading,
  createTable,
} from './ui.js';

export function createAdminsView({ request, showToast, currentAdmin }) {
  const section = createEl('section', 'admin-page');
  let disposed = false;
  let loading = false;

  section.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Доступ</p>
        <h1 tabindex="-1">Администраторы</h1>
        <p class="muted">Все администраторы видят ответы и статистику. Добавляйте только доверенных людей.</p>
      </div>
    </div>

    <div class="admins-layout">
      <section class="panel admin-form-panel">
        <h2>Добавить администратора</h2>
        <p class="muted">Логин: 3–32 символа, латиница, цифры, точка, дефис или подчёркивание.</p>
        <form class="admin-form" data-add-form novalidate>
          <div class="admin-form__fields"></div>
          <p class="form-error" role="alert" hidden data-form-error></p>
          <button class="btn btn--primary btn--block" type="submit" data-submit>
            Создать администратора
          </button>
        </form>
      </section>

      <section class="panel admins-list-panel">
        <div class="panel__head">
          <div>
            <h2>Учётные записи</h2>
            <p class="muted">Отключённый администратор не может войти.</p>
          </div>
          <button class="btn btn--secondary" type="button" data-refresh>Обновить</button>
        </div>
        <div class="admins-list-body" aria-live="polite"></div>
      </section>
    </div>
  `;

  const addForm = section.querySelector('[data-add-form]');
  const fields = section.querySelector('.admin-form__fields');
  const formError = section.querySelector('[data-form-error]');
  const submitButton = section.querySelector('[data-submit]');
  const refreshButton = section.querySelector('[data-refresh]');
  const listBody = section.querySelector('.admins-list-body');

  const loginInput = createInput({
    id: 'new-admin-login',
    name: 'login',
    placeholder: 'например, manager',
    autocomplete: 'off',
    required: true,
    minLength: 3,
  });

  const passwordInput = createInput({
    id: 'new-admin-password',
    name: 'password',
    type: 'password',
    placeholder: 'не менее 8 символов',
    autocomplete: 'new-password',
    required: true,
    minLength: 8,
  });

  fields.append(
    createField('Логин', loginInput, { forId: 'new-admin-login' }),
    createField('Пароль', passwordInput, {
      forId: 'new-admin-password',
      hint: 'Передайте пароль новому администратору по защищённому каналу.',
    }),
  );

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearFormError() {
    formError.textContent = '';
    formError.hidden = true;
  }

  function renderAdmins(items) {
    if (items.length === 0) {
      listBody.replaceChildren(
        createEmptyState({
          title: 'Список администраторов пуст',
          text: 'Создайте первую учётную запись в форме слева.',
        }),
      );
      return;
    }

    const rows = items.map((admin) => {
      const status = createBadge(
        admin.isActive ? 'Активен' : 'Отключён',
        admin.isActive ? 'success' : 'muted',
      );

      const actions = createEl('div', 'row-actions');
      const passwordButton = createEl(
        'button',
        'btn btn--secondary btn--compact',
        'Пароль',
      );
      passwordButton.type = 'button';
      passwordButton.addEventListener('click', async () => {
        const password = await promptModal({
          title: `Новый пароль для «${admin.login}»`,
          message: 'После смены пароля все сессии этого администратора будут завершены.',
          label: 'Новый пароль',
          type: 'password',
          placeholder: 'не менее 8 символов',
          confirmLabel: 'Сменить пароль',
          minLength: 8,
          autocomplete: 'new-password',
          hint: 'Используйте длинный пароль и передайте его по защищённому каналу.',
        });

        if (!password) return;

        try {
          await request(() => updateAdmin(admin.id, { password }));
          showToast(
            admin.id === currentAdmin.id
              ? 'Пароль изменён. Текущая сессия сохранена.'
              : 'Пароль изменён',
          );
          await load();
        } catch (error) {
          if (error?.status === 401) return;
          showToast(error?.message || 'Не удалось изменить пароль', 'error');
        }
      });

      const toggleButton = createEl(
        'button',
        `btn btn--compact ${
          admin.isActive ? 'btn--danger' : 'btn--secondary'
        }`,
        admin.isActive ? 'Отключить' : 'Включить',
      );
      toggleButton.type = 'button';

      if (admin.id === currentAdmin.id) {
        toggleButton.disabled = true;
        toggleButton.title = 'Нельзя отключить собственную учётную запись';
      } else {
        toggleButton.addEventListener('click', async () => {
          if (admin.isActive) {
            const confirmed = await confirmModal({
              title: `Отключить «${admin.login}»?`,
              message:
                'Администратор не сможет войти, пока вы снова не включите учётную запись. Все его сессии будут завершены.',
              confirmLabel: 'Отключить',
              cancelLabel: 'Отмена',
            });

            if (!confirmed) return;
          }

          try {
            await request(() =>
              updateAdmin(admin.id, { active: !admin.isActive }),
            );
            showToast(
              admin.isActive
                ? 'Администратор отключён'
                : 'Администратор включён',
            );
            await load();
          } catch (error) {
            if (error?.status === 401) return;
            showToast(
              error?.message || 'Не удалось изменить статус администратора',
              'error',
            );
          }
        });
      }

      actions.append(passwordButton, toggleButton);

      return [
        admin.login,
        status,
        formatDate(admin.createdAt),
        formatDate(admin.lastLoginAt),
        actions,
      ];
    });

    listBody.replaceChildren(
      createTable(
        ['Логин', 'Статус', 'Создан', 'Последний вход', 'Действия'],
        rows,
        { tableClass: 'table--admins' },
      ),
    );
  }

  async function load() {
    if (loading || disposed) return;
    loading = true;
    refreshButton.disabled = true;
    listBody.replaceChildren(createLoading('Загружаю администраторов…'));

    try {
      const data = await request(getAdmins);
      if (disposed) return;
      renderAdmins(data.items);
    } catch (error) {
      if (disposed) return;
      if (error?.status === 401) return;

      listBody.replaceChildren(
        createErrorBlock(
          error?.message || 'Не удалось загрузить администраторов.',
          () => load(),
        ),
      );
    } finally {
      loading = false;
      if (!disposed) refreshButton.disabled = false;
    }
  }

  addForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError();

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (login.length < 3) {
      showFormError('Логин должен содержать не менее 3 символов.');
      loginInput.focus();
      return;
    }

    if (password.length < 8) {
      showFormError('Пароль должен содержать не менее 8 символов.');
      passwordInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Создаю…';

    try {
      await request(() => createAdmin({ login, password }));
      addForm.reset();
      showToast('Администратор создан');
      await load();
    } catch (error) {
      if (error?.status === 401) return;
      showFormError(error?.message || 'Не удалось создать администратора.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Создать администратора';
    }
  });

  refreshButton.addEventListener('click', () => load());

  load();

  return {
    element: section,
    destroy() {
      disposed = true;
    },
  };
}
