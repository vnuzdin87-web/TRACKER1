import { describe, expect, it } from 'vitest';
import {
  isValidAgeGroup,
  isValidGender,
  isValidStoredResponse,
  validateResponse,
} from '../src/validation.js';

const validScores = {
  confidence: 7,
  sensitivity: 5,
  initiative: 8,
  adaptability: 6,
  overall: 7,
};

function validResponse(overrides = {}) {
  return {
    id: '5f1c2a9e-6d7b-4c2a-9f3e-1a2b3c4d5e6f',
    createdAt: '2026-11-13T10:15:30.000Z',
    gender: 'm',
    ageGroup: '25to35',
    scores: { ...validScores },
    ...overrides,
  };
}

describe('validateResponse', () => {
  it('accepts a complete response', () => {
    expect(
      validateResponse({
        gender: 'f',
        ageGroup: 'under25',
        scores: validScores,
      }),
    ).toEqual({ valid: true, errors: {} });
  });

  it('requires gender and age', () => {
    const result = validateResponse({
      gender: '',
      ageGroup: '',
      scores: validScores,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.gender).toBe('Выберите пол');
    expect(result.errors.ageGroup).toBe('Выберите возраст');
  });

  it('rejects unexpected gender and age values', () => {
    const result = validateResponse({
      gender: '<script>',
      ageGroup: 'unknown',
      scores: validScores,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.gender).toBeDefined();
    expect(result.errors.ageGroup).toBeDefined();
  });

  it('rejects missing and out-of-range scores', () => {
    const result = validateResponse({
      gender: 'm',
      ageGroup: 'over35',
      scores: {
        confidence: 0,
        sensitivity: 11,
        initiative: 5.5,
        adaptability: '7',
        overall: 10,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors['scores.confidence']).toBe(
      'Оценка должна быть от 1 до 10',
    );
    expect(result.errors['scores.sensitivity']).toBeDefined();
    expect(result.errors['scores.initiative']).toBeDefined();
    expect(result.errors['scores.adaptability']).toBeDefined();
    expect(result.errors['scores.overall']).toBeUndefined();
  });

  it('reports all five score errors when scores are missing', () => {
    const result = validateResponse({
      gender: 'm',
      ageGroup: '25to35',
      scores: null,
    });

    expect(result.valid).toBe(false);
    expect(
      Object.keys(result.errors).filter((key) => key.startsWith('scores.')),
    ).toHaveLength(5);
  });
});

describe('isValidStoredResponse', () => {
  it('accepts a valid stored response', () => {
    expect(isValidStoredResponse(validResponse())).toBe(true);
  });

  it('ignores extra fields', () => {
    expect(
      isValidStoredResponse({
        ...validResponse(),
        name: 'Иван',
        comment: '<b>hello</b>',
      }),
    ).toBe(true);
  });

  it('rejects non-objects and arrays', () => {
    expect(isValidStoredResponse(null)).toBe(false);
    expect(isValidStoredResponse('response')).toBe(false);
    expect(isValidStoredResponse([])).toBe(false);
  });

  it('rejects missing or invalid id and createdAt', () => {
    expect(isValidStoredResponse(validResponse({ id: '' }))).toBe(false);
    expect(isValidStoredResponse(validResponse({ id: 42 }))).toBe(false);
    expect(isValidStoredResponse(validResponse({ createdAt: '' }))).toBe(false);
    expect(
      isValidStoredResponse(validResponse({ createdAt: 'not-a-date' })),
    ).toBe(false);
  });

  it('rejects invalid gender and age group', () => {
    expect(isValidStoredResponse(validResponse({ gender: 'x' }))).toBe(false);
    expect(isValidStoredResponse(validResponse({ ageGroup: 'unknown' }))).toBe(
      false,
    );
  });

  it('rejects invalid score values and missing keys', () => {
    expect(
      isValidStoredResponse(
        validResponse({
          scores: { ...validScores, confidence: 99 },
        }),
      ),
    ).toBe(false);

    const missing = { ...validScores };
    delete missing.overall;
    expect(isValidStoredResponse(validResponse({ scores: missing }))).toBe(
      false,
    );
  });

  it('rejects scores that are not an object', () => {
    expect(isValidStoredResponse(validResponse({ scores: null }))).toBe(false);
    expect(isValidStoredResponse(validResponse({ scores: [] }))).toBe(false);
  });
});

describe('value guards', () => {
  it('recognises valid gender values', () => {
    expect(isValidGender('m')).toBe(true);
    expect(isValidGender('f')).toBe(true);
    expect(isValidGender('x')).toBe(false);
  });

  it('recognises valid age group values', () => {
    expect(isValidAgeGroup('under25')).toBe(true);
    expect(isValidAgeGroup('25to35')).toBe(true);
    expect(isValidAgeGroup('over35')).toBe(true);
    expect(isValidAgeGroup('36+')).toBe(false);
  });
});
