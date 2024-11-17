import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import createCollection from './createCollection.js';
import { createClient, RedisClientType } from 'redis';
import Collection from './Collection.js';
import { beforeEach } from 'node:test';

describe('createCollection', () => {
  let redis: RedisClientType;
  let name: string = 'test_createCollection';
  let redisKey: string;
  let nameWithData: string = 'test_createCollectionWithData';
  let redisKeyWithData: string;

  beforeAll(async () => {
    redis = createClient({ url: 'redis://127.0.0.1:6379' });
    await redis.connect();
    const collection = await createCollection(
      name,
      { redis },
      {
        dummy: { id: 'dummy', test: 'dummy' },
      },
    );
    redisKey = collection.redisKey;
    const collectionWithData = await createCollection(
      nameWithData,
      { redis },
      {
        dummy: { id: 'dummy', test: 'dummy' },
      },
    );
    redisKeyWithData = collectionWithData.redisKey;
  });

  beforeEach(async () => {});

  it('Creates and initializes a new collection', async () => {
    const collection = await createCollection(name, { redis });
    expect(collection).toBeInstanceOf(Collection);
  });

  it('Creates and initializes a new collection with array of docs', async () => {
    const collection = await createCollection(name, { redis }, [
      { id: '1', test: 'one' },
      { id: '2', test: 'two' },
    ]);
    expect(collection).toBeInstanceOf(Collection);
    expect(collection.get('1')).toEqual({ id: '1', test: 'one' });
    expect(collection.get('2')).toEqual({ id: '2', test: 'two' });
  });

  it('Creates and initializes a new collection with object of docs', async () => {
    const collection = await createCollection(
      name,
      { redis },
      {
        '1': { id: '1', test: 'one' },
        '2': { id: '2', test: 'two' },
      },
    );
    expect(collection).toBeInstanceOf(Collection);
    expect(collection.get('1')).toEqual({ id: '1', test: 'one' });
    expect(collection.get('2')).toEqual({ id: '2', test: 'two' });
  });

  it('Creates and initializes a new collection with pre-existing data', async () => {
    const collection = await createCollection(nameWithData, { redis });
    expect(collection).toBeInstanceOf(Collection);
    expect(collection.get('dummy')).toEqual({ id: 'dummy', test: 'dummy' });
  });

  afterEach(async () => {
    await redis.del(redisKey);
  });

  afterAll(async () => {
    await redis.del(redisKeyWithData);
    await redis.quit();
  });
});
