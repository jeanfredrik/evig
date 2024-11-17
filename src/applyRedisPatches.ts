import { RedisClientType } from 'redis';
import { RedisPatch } from './types';
import { applyPatches, enablePatches } from 'immer';
import toImmerPatch from './toImmerPatch';
import stringifyDoc from './stringifyDoc';
import parseDoc from './parseDoc';
import { Document } from './Document';
// import { map } from 'ramda';

enablePatches();

export default async function applyRedisPatches<
  TDocument extends Document<any>,
>(redis: RedisClientType, redisKey: string, redisPatches: RedisPatch[]) {
  const pipeline = redis.multi();
  for (const redisPatch of redisPatches) {
    const { op, field, value, patch } = redisPatch;
    switch (op) {
      case 'set':
        {
          pipeline.hSet(redisKey, field, stringifyDoc(value));
        }
        break;
      case 'del':
        {
          pipeline.hDel(redisKey, field);
        }
        break;
      case 'patch':
        {
          if (!patch) {
            throw new Error(
              `Patch missing in RedisPatch with field "${field}"`,
            );
          }
          let value = await redis.hGet(redisKey, field);
          if (!value) {
            throw new Error(
              `Field "${field}" not found in Redis for key "${redisKey}"`,
            );
          }
          let doc: TDocument = parseDoc(value);
          doc = applyPatches(doc, [toImmerPatch(patch)]);
          pipeline.hSet(redisKey, field, stringifyDoc(doc));
        }
        break;
      default:
        throw new Error(`Unknown op in RedisPatch: ${op}`);
    }
  }
  await pipeline.exec();
}
