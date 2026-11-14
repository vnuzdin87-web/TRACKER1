import { createEl } from './utils.js';

const TOAST_DURATION = 3200;
const TOAST_EXIT_DURATION = 220;

export function showToast(message, type = 'success') {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const toast = createEl('div', `toast toast--${type}`, message);
  toast.setAttribute('role', 'status');

  region.append(toast);

  window.setTimeout(() => {
    toast.classList.add('toast--leaving');
    window.setTimeout(() => {
      toast.remove();
    }, TOAST_EXIT_DURATION);
  }, TOAST_DURATION);
}
