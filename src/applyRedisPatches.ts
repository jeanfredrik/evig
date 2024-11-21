import { RedisClientType } from 'redis';
import { RedisPatch } from './types.d.js';
import { applyPatches, enablePatches } from 'immer';
import toImmerPatch from './toImmerPatch.js';
import stringifyDoc from './stringifyDoc.js';
import parseDoc from './parseDoc.js';
import { Document } from './Document.js';
// import { map } from 'ramda';

enablePatches();

export default async function applyRedisPatches<
  TDocument extends Document<any>,
>(redis: RedisClientType, redisKey: string, redisPatches: RedisPatch[]) {
  const pipeline = redis.multi();
  const intermediate: Record<string, TDocument | undefined> = {};
  for (const redisPatch of redisPatches) {
    const { op, field, value, patch } = redisPatch;
    switch (op) {
      case 'set':
        {
          intermediate[field] = value;
        }
        break;
      case 'del':
        {
          intermediate[field] = undefined;
        }
        break;
      case 'patch':
        {
          if (!patch) {
            throw new Error(
              `Patch missing in RedisPatch with field "${field}"`,
            );
          }
          if (!(field in intermediate)) {
            const prevValue = await redis.hGet(redisKey, field);
            intermediate[field] = prevValue ? parseDoc(prevValue) : undefined;
          }
          if (!intermediate[field]) {
            throw new Error(
              `Field "${field}" not found in Redis for key "${redisKey}"`,
            );
          }
          intermediate[field] = applyPatches(intermediate[field], [
            toImmerPatch(patch),
          ]);
        }
        break;
      default:
        throw new Error(`Unknown op in RedisPatch: ${op}`);
    }
  }
  for (const [field, value] of Object.entries(intermediate)) {
    if (value === undefined) {
      // console.log('hdel', redisKey, field);
      pipeline.hDel(redisKey, field);
    } else {
      // console.log('hset', redisKey, field, stringifyDoc(value));
      pipeline.hSet(redisKey, field, stringifyDoc(value));
    }
  }
  await pipeline.exec();
}
