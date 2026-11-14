import { describe, expect, it } from 'vitest';
import {
  getAgeDistribution,
  getAverageByParam,
  getCount,
  getLastResponseDate,
  getOverallAverage,
  getResponseAverage,
} from '../src/stats.js';

function response(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    createdAt: '2026-11-13T10:00:00.000Z',
    gender: 'm',
    ageGroup: '25to35',
    scores: {
      confidence: 5,
      sensitivity: 5,
      initiative: 5,
      adaptability: 5,
      overall: 5,
    },
    ...overrides,
  };
}

const threeResponses = [
  response({
    id: 'a',
    createdAt: '2026-11-13T10:00:00.000Z',
    ageGroup: 'under25',
    scores: {
      confidence: 7,
      sensitivity: 5,
      initiative: 8,
      adaptability: 6,
      overall: 7,
    },
  }),
  response({
    id: 'b',
    createdAt: '2026-11-13T11:00:00.000Z',
    ageGroup: '25to35',
    scores: {
      confidence: 3,
      sensitivity: 9,
      initiative: 4,
      adaptability: 10,
      overall: 2,
    },
  }),
  response({
    id: 'c',
    createdAt: '2026-11-13T12:00:00.000Z',
    ageGroup: 'under25',
    scores: {
      confidence: 10,
      sensitivity: 1,
      initiative: 6,
      adaptability: 4,
      overall: 9,
    },
  }),
];

describe('getCount', () => {
  it('returns the number of responses', () => {
    expect(getCount([])).toBe(0);
    expect(getCount(threeResponses)).toBe(3);
  });
});

describe('getAverageByParam', () => {
  it('returns null for an empty list', () => {
    expect(getAverageByParam([], 'confidence')).toBeNull();
  });

  it('returns the single score for one response', () => {
    expect(getAverageByParam([response()], 'confidence')).toBe(5);
  });

  it('calculates and rounds averages to one decimal', () => {
    expect(getAverageByParam(threeResponses, 'confidence')).toBe(6.7);
    expect(getAverageByParam(threeResponses, 'sensitivity')).toBe(5);
    expect(getAverageByParam(threeResponses, 'initiative')).toBe(6);
    expect(getAverageByParam(threeResponses, 'adaptability')).toBe(6.7);
    expect(getAverageByParam(threeResponses, 'overall')).toBe(6);
  });

  it('ignores invalid scores', () => {
    const data = [
      response({ scores: { ...response().scores, confidence: 8 } }),
      { ...response(), scores: { ...response().scores, confidence: 99 } },
    ];
    expect(getAverageByParam(data, 'confidence')).toBe(8);
  });
});

describe('getOverallAverage', () => {
  it('returns null for an empty list', () => {
    expect(getOverallAverage([])).toBeNull();
  });

  it('averages all five scores across all responses', () => {
    expect(getOverallAverage(threeResponses)).toBe(6.1);
  });

  it('uses every score, not the average of averages', () => {
    const data = [
      response({
        scores: {
          confidence: 10,
          sensitivity: 10,
          initiative: 10,
          adaptability: 10,
          overall: 10,
        },
      }),
      response({
        scores: {
          confidence: 1,
          sensitivity: 1,
          initiative: 1,
          adaptability: 1,
          overall: 1,
        },
      }),
    ];
    expect(getOverallAverage(data)).toBe(5.5);
  });
});

describe('getAgeDistribution', () => {
  it('returns zeroes for an empty list', () => {
    const distribution = getAgeDistribution([]);
    expect(distribution).toHaveLength(3);
    expect(distribution.map((item) => item.count)).toEqual([0, 0, 0]);
    expect(distribution.map((item) => item.share)).toEqual([0, 0, 0]);
  });

  it('counts groups in fixed order and calculates shares', () => {
    const distribution = getAgeDistribution(threeResponses);
    expect(distribution.map((item) => item.label)).toEqual([
      'до 25',
      '25–35',
      'старше 35',
    ]);
    expect(distribution.map((item) => item.count)).toEqual([2, 1, 0]);
    expect(distribution[0].share).toBeCloseTo(66.666, 2);
    expect(distribution[1].share).toBeCloseTo(33.333, 2);
    expect(distribution[2].share).toBe(0);
    expect(distribution.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(
      100,
      5,
    );
  });
});

describe('getLastResponseDate', () => {
  it('returns null without responses', () => {
    expect(getLastResponseDate([])).toBeNull();
  });

  it('returns the latest ISO date', () => {
    expect(getLastResponseDate(threeResponses)).toBe(
      '2026-11-13T12:00:00.000Z',
    );
  });

  it('ignores invalid dates', () => {
    const data = [
      response({ createdAt: '2026-11-13T10:00:00.000Z' }),
      response({ createdAt: 'not-a-date' }),
    ];
    expect(getLastResponseDate(data)).toBe('2026-11-13T10:00:00.000Z');
  });
});

describe('getResponseAverage', () => {
  it('averages the five scores of one response', () => {
    expect(getResponseAverage(threeResponses[0])).toBe(6.6);
  });

  it('returns null if no valid scores exist', () => {
    expect(getResponseAverage({ scores: {} })).toBeNull();
  });
});
