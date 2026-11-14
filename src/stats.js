import { AGE_GROUPS, MAX_SCORE, MIN_SCORE, PARAMS } from './constants.js';
import { roundToOne } from './utils.js';

function isValidScore(value) {
  return Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

function getScores(responses, key) {
  return responses
    .map((response) => response?.scores?.[key])
    .filter((value) => isValidScore(value));
}

export function getCount(responses = []) {
  return responses.length;
}

export function getAverageByParam(responses = [], key) {
  const values = getScores(responses, key);
  if (values.length === 0) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  return roundToOne(sum / values.length);
}

export function getOverallAverage(responses = []) {
  const values = [];
  for (const { key } of PARAMS) {
    values.push(...getScores(responses, key));
  }

  if (values.length === 0) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  return roundToOne(sum / values.length);
}

export function getAgeDistribution(responses = []) {
  const total = responses.length;

  return AGE_GROUPS.map((group) => {
    const count = responses.filter(
      (response) => response?.ageGroup === group.value,
    ).length;

    return {
      ...group,
      count,
      share: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

export function getLastResponseDate(responses = []) {
  let latest = null;

  for (const response of responses) {
    const timestamp = Date.parse(response?.createdAt);
    if (Number.isNaN(timestamp)) continue;
    if (latest === null || timestamp > latest) {
      latest = timestamp;
    }
  }

  return latest === null ? null : new Date(latest).toISOString();
}

export function getResponseAverage(response) {
  const values = PARAMS.map(({ key }) => response?.scores?.[key]).filter(
    isValidScore,
  );

  if (values.length === 0) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  return roundToOne(sum / values.length);
}
