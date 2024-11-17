import { ImmerPatch } from './types.d.js';

/**
 * Turns a patch that adds an object into multiple patches, one for each operation.
 * Turns {path: 'foo', op: 'replace', value: {'bar': 'baz'}} into [{op: 'replace', path: ['foo'], value: {}}, {op: 'replace', path: ['foo', 'bar'], value: 'baz'}]
 */
export default function expandImmerPatch(patch: ImmerPatch): ImmerPatch[] {
  const { path, op, value } = patch;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    switch (op) {
      case 'replace':
      case 'add':
        return [
          { op, path, value: {} },
          ...Object.entries(value)
            .map(([key, value]) => ({
              op: 'add' as const,
              path: path.concat(key),
              value,
            }))
            .flatMap((patch) => expandImmerPatch(patch)),
        ];
    }
  }
  return [patch];
}
