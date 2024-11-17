import { describe, test, expect } from 'vitest';
import { Patch } from './types.d.js';
import toRedisPatches from './toRedisPatches.js';

describe('toRedisPatches', () => {
  test('It handles empty patch list', () => {
    const patches: Patch[] = [];
    expect(toRedisPatches(patches)).toEqual([]);
  });

  test('It handles add on collection', () => {
    const patches: Patch[] = [
      { op: 'add', path: '123', value: { id: 123, name: 'test' } },
    ];
    expect(toRedisPatches(patches)).toEqual([
      {
        op: 'set',
        field: '123',
        value: { id: 123, name: 'test' },
      },
    ]);
  });

  test('It handles add on document', () => {
    const patches: Patch[] = [{ op: 'add', path: '123/name', value: 'test' }];
    expect(toRedisPatches(patches)).toEqual([
      {
        op: 'patch',
        field: '123',
        patch: { op: 'add', path: 'name', value: 'test' },
      },
    ]);
  });

  test('It handles replace on collection', () => {
    const patches: Patch[] = [
      { op: 'replace', path: '123', value: { id: 123, name: 'test' } },
    ];
    expect(toRedisPatches(patches)).toEqual([
      // { op: 'del', field: '123' },
      { op: 'set', field: '123', value: { id: 123, name: 'test' } },
    ]);
  });
  test('It handles replace on document', () => {
    const patches: Patch[] = [
      { op: 'replace', path: '123/name', value: 'test' },
    ];
    expect(toRedisPatches(patches)).toEqual([
      {
        op: 'patch',
        field: '123',
        patch: { op: 'replace', path: 'name', value: 'test' },
      },
    ]);
  });

  test('It handles remove on collection', () => {
    const patches: Patch[] = [{ op: 'remove', path: '123' }];
    expect(toRedisPatches(patches)).toEqual([{ op: 'del', field: '123' }]);
  });
  test('It handles remove on document', () => {
    const patches: Patch[] = [{ op: 'remove', path: '123/name' }];
    expect(toRedisPatches(patches)).toEqual([
      { op: 'patch', field: '123', patch: { op: 'remove', path: 'name' } },
    ]);
  });

  test('It handles add on value', () => {
    const patches: Patch[] = [
      { op: 'add', path: '123/name/first', value: 'test' },
    ];
    expect(toRedisPatches(patches)).toEqual([
      {
        op: 'patch',
        field: '123',
        patch: { op: 'add', path: 'name/first', value: 'test' },
      },
    ]);
  });

  test('It handles replace on value', () => {
    const patches: Patch[] = [
      { op: 'replace', path: '123/name/first', value: 'test' },
    ];
    expect(toRedisPatches(patches)).toEqual([
      {
        op: 'patch',
        field: '123',
        patch: { op: 'replace', path: 'name/first', value: 'test' },
      },
    ]);
  });

  test('It handles remove on value', () => {
    const patches: Patch[] = [{ op: 'remove', path: '123/name/first' }];
    expect(toRedisPatches(patches)).toEqual([
      {
        op: 'patch',
        field: '123',
        patch: { op: 'remove', path: 'name/first' },
      },
    ]);
  });

  test('It throws on invalid path', () => {
    const patches: Patch[] = [{ op: 'add', path: '/abc' }];
    expect(() => toRedisPatches(patches)).toThrow('Invalid path: /abc');
  });
});
