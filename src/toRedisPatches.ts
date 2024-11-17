import { Patch, RedisPatch } from './types.d.js';

export default function toRedisPatches(patches: Patch[]): RedisPatch[] {
  const redisPatches: RedisPatch[] = [];
  patches.forEach((patch) => {
    const { op, path, value } = patch;
    const match = path.match(/^([^/]+)(?:\/(.*))?$/);
    if (!match) {
      throw new Error(`Invalid path: ${path}`);
    }
    const [, field, subpath] = match;
    if (subpath) {
      redisPatches.push({
        op: 'patch',
        field,
        patch: { op, path: subpath, value },
      });
    } else {
      switch (op) {
        case 'add':
          redisPatches.push({ op: 'set', field, value });
          break;
        case 'replace':
          // redisPatches.push({ op: 'del', field });
          redisPatches.push({ op: 'set', field, value });
          break;
        case 'remove':
          redisPatches.push({ op: 'del', field });
          break;
      }
    }
  });
  return redisPatches;
}
