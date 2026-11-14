export const APP_VERSION = '2.0.0';

export const ADMIN_PATH = '/admin';

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
export const DEFAULT_SCORE = 5;
export const LOW_DATA_THRESHOLD = 5;

export const PARAMS = [
  {
    key: 'confidence',
    label: 'Уверенность',
    hint: 'Насколько уверенно держится и отстаивает позицию',
  },
  {
    key: 'sensitivity',
    label: 'Чувствительность',
    hint: 'Насколько тонко реагирует на эмоции, контекст и обратную связь',
  },
  {
    key: 'initiative',
    label: 'Инициативность',
    hint: 'Готовность начинать, предлагать и действовать первым',
  },
  {
    key: 'adaptability',
    label: 'Адаптивность',
    hint: 'Лёгкость и скорость приспособления к изменениям',
  },
  {
    key: 'overall',
    label: 'Общее впечатление',
    hint: 'Интегральная оценка партнёра',
  },
];

export const GENDERS = [
  { value: 'm', label: 'М' },
  { value: 'f', label: 'Ж' },
];

export const AGE_GROUPS = [
  { value: 'under25', label: 'до 25' },
  { value: '25to35', label: '25–35' },
  { value: 'over35', label: 'старше 35' },
];

export const ROUTES = {
  start: '#/',
  survey: '#/survey',
  done: '#/done',
  stats: '#/stats',
};

export const PAGE_TITLES = {
  [ROUTES.start]: 'Оценка партнёра — трекер оценок',
  [ROUTES.survey]: 'Опрос — трекер оценок',
  [ROUTES.done]: 'Спасибо — трекер оценок',
  [ROUTES.stats]: 'Статистика — трекер оценок',
};
