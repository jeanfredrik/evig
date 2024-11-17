import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
} from 'vitest';
import { RedisClientType, createClient } from 'redis';

import { RedisPatch } from './types.d.js';
import applyRedisPatches from './applyRedisPatches.js';

describe('applyRedisPatches', () => {
  let redis: RedisClientType;
  const key = 'test';

  beforeAll(async () => {
    redis = createClient({ url: 'redis://127.0.0.1:6379' });
    await redis.connect();
    redis.del(key);
  });

  beforeEach(async () => {
    await redis.hSet(key, 'dummy', '{"test":"dummy"}');
  });

  it('Handles "set" commands', async () => {
    const redisPatches1: RedisPatch[] = [
      { op: 'set', field: '1', value: { test: 'one' } },
      { op: 'set', field: '2', value: { test: 'two' } },
    ];
    await applyRedisPatches(redis, key, redisPatches1);
    expect(await redis.hGetAll(key)).toEqual({
      dummy: '{"test":"dummy"}',
      1: '{"test":"one"}',
      2: '{"test":"two"}',
    });

    const redisPatches2: RedisPatch[] = [
      { op: 'set', field: '1', value: { test: 'updated' } },
      { op: 'set', field: '2', value: { foo: 'bar' } },
    ];
    await applyRedisPatches(redis, key, redisPatches2);
    expect(await redis.hGetAll(key)).toEqual({
      dummy: '{"test":"dummy"}',
      1: '{"test":"updated"}',
      2: '{"foo":"bar"}',
    });
  });

  it('Handles "del" commands', async () => {
    const redisPatches1: RedisPatch[] = [{ op: 'del', field: 'dummy' }];
    await applyRedisPatches(redis, key, redisPatches1);
    expect(await redis.hGetAll(key)).toEqual({});
  });

  it('Handles "patch" commands', async () => {
    const redisPatches1: RedisPatch[] = [
      {
        op: 'patch',
        field: 'dummy',
        patch: { op: 'add', path: 'foo', value: 'bar' },
      },
    ];
    await applyRedisPatches(redis, key, redisPatches1);
    expect(await redis.hGetAll(key)).toEqual({
      dummy: '{"test":"dummy","foo":"bar"}',
    });

    const redisPatches2: RedisPatch[] = [
      {
        op: 'patch',
        field: 'dummy',
        patch: { op: 'replace', path: 'foo', value: 'yolo' },
      },
    ];
    await applyRedisPatches(redis, key, redisPatches2);
    expect(await redis.hGetAll(key)).toEqual({
      dummy: '{"test":"dummy","foo":"yolo"}',
    });

    const redisPatches3: RedisPatch[] = [
      {
        op: 'patch',
        field: 'dummy',
        patch: { op: 'remove', path: 'foo' },
      },
    ];
    await applyRedisPatches(redis, key, redisPatches3);
    expect(await redis.hGetAll(key)).toEqual({
      dummy: '{"test":"dummy"}',
    });
  });

  it("Throws if a 'patch' command is missing the 'patch' field", async () => {
    const redisPatches: RedisPatch[] = [{ op: 'patch', field: 'dummy' }];
    await expect(applyRedisPatches(redis, key, redisPatches)).rejects.toThrow(
      `Patch missing in RedisPatch with field "dummy"`,
    );
  });

  it('Throws if a field is not found in Redis', async () => {
    const redisPatches: RedisPatch[] = [
      {
        op: 'patch',
        field: 'missing',
        patch: { op: 'add', path: 'foo', value: 'bar' },
      },
    ];
    await expect(applyRedisPatches(redis, key, redisPatches)).rejects.toThrow(
      `Field "missing" not found in Redis for key "${key}"`,
    );
  });

  it('Throws if an unknown op is found in a RedisPatch', async () => {
    // @ts-ignore
    const redisPatches: RedisPatch[] = [{ op: 'unknown', field: 'dummy' }];
    await expect(applyRedisPatches(redis, key, redisPatches)).rejects.toThrow(
      `Unknown op in RedisPatch: unknown`,
    );
  });

  afterEach(async () => {
    redis.del(key);
  });

  afterAll(() => {
    redis.quit();
  });
});
