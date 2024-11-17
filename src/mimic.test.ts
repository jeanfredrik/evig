import { describe, test, expect } from 'vitest';
import { produceWithPatches, enablePatches } from 'immer';
import mimic from './mimic.js';

enablePatches();

describe('mimic', () => {
  test('Makes a minimal set of changes', () => {
    const source = {
      count: 0,
      foo: {
        bar: 1,
      },
    };
    const target = {
      count: 1,
      foo: {
        bar: 2,
      },
    };
    const [result, patches] = produceWithPatches(source, (draft) => {
      mimic(draft, target);
    });
    expect(result).toEqual(target);
    expect(patches).toEqual([
      {
        op: 'replace',
        path: ['foo', 'bar'],
        value: 2,
      },
      {
        op: 'replace',
        path: ['count'],
        value: 1,
      },
    ]);
  });

  test('Removes properties not in target', () => {
    const source = {
      count: 0,
      foo: {
        bar: 1,
      },
    };
    const target = {
      count: 1,
    };
    const [result, patches] = produceWithPatches(source, (draft) => {
      mimic(draft, target);
    });
    expect(result).toEqual(target);
    expect(patches).toEqual([
      {
        op: 'replace',
        path: ['count'],
        value: 1,
      },
      {
        op: 'remove',
        path: ['foo'],
      },
    ]);
  });
});
