import { describe } from 'vitest';
import expandImmerPatch from './expandImmerPatch';
import { test, expect } from 'vitest';
import { ImmerPatch } from './types';

describe('expandImmerPatch', () => {
  test('It expands a patch that adds an object into multiple patches', () => {
    const patch1: ImmerPatch = {
      path: ['foo'],
      op: 'replace',
      value: { bar: 'baz' },
    };
    expect(expandImmerPatch(patch1)).toEqual([
      { op: 'replace', path: ['foo'], value: {} },
      { op: 'add', path: ['foo', 'bar'], value: 'baz' },
    ]);
    const patch2: ImmerPatch = {
      path: ['foo'],
      op: 'add',
      value: { bar: 'baz' },
    };
    expect(expandImmerPatch(patch2)).toEqual([
      { op: 'add', path: ['foo'], value: {} },
      { op: 'add', path: ['foo', 'bar'], value: 'baz' },
    ]);
  });
});
