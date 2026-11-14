import {
  AGE_GROUPS,
  GENDERS,
  MAX_SCORE,
  MIN_SCORE,
  PARAMS,
} from './constants.js';

const GENDER_VALUES = new Set(GENDERS.map((item) => item.value));
const AGE_VALUES = new Set(AGE_GROUPS.map((item) => item.value));

const SCORE_ERROR = 'Оценка должна быть от 1 до 10';

export function validateResponse(data = {}) {
  const errors = {};
  const { gender, ageGroup, scores } = data;

  if (!GENDER_VALUES.has(gender)) {
    errors.gender = 'Выберите пол';
  }

  if (!AGE_VALUES.has(ageGroup)) {
    errors.ageGroup = 'Выберите возраст';
  }

  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    for (const { key } of PARAMS) {
      errors[`scores.${key}`] = SCORE_ERROR;
    }
  } else {
    for (const { key } of PARAMS) {
      const value = scores[key];
      if (!Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
        errors[`scores.${key}`] = SCORE_ERROR;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function isValidStoredResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  if (typeof data.id !== 'string' || data.id.trim() === '') {
    return false;
  }

  if (
    typeof data.createdAt !== 'string' ||
    Number.isNaN(Date.parse(data.createdAt))
  ) {
    return false;
  }

  if (!GENDER_VALUES.has(data.gender)) {
    return false;
  }

  if (!AGE_VALUES.has(data.ageGroup)) {
    return false;
  }

  const scores = data.scores;
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    return false;
  }

  return PARAMS.every(({ key }) => {
    const value = scores[key];
    return (
      Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE
    );
  });
}

export function isValidGender(value) {
  return GENDER_VALUES.has(value);
}

export function isValidAgeGroup(value) {
  return AGE_VALUES.has(value);
}
