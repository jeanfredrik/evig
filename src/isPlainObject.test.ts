import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from 'vitest';
import isPlainObject from './isPlainObject.js';

describe('isPlainObject', () => {
  it('Returns false if the value is a scalar (including null)', () => {
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject('foo')).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
  it('Returns false if the value is an array', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2, 3])).toBe(false);
  });
  it('Returns treue if the value is a plain object', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ foo: 'bar' })).toBe(true);
  });
  it('Returns false if the value is a function', () => {
    expect(isPlainObject(() => {})).toBe(false);
  });
  it('Returns false if the value is a Date object', () => {
    expect(isPlainObject(new Date())).toBe(false);
  });
  it('Returns false if the value is a RegExp object', () => {
    expect(isPlainObject(/foo/)).toBe(false);
  });
  it('Returns false if the value is a Map object', () => {
    expect(isPlainObject(new Map())).toBe(false);
  });
  it('Returns false if the value is a Set object', () => {
    expect(isPlainObject(new Set())).toBe(false);
  });
});
