import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import createView from './createView.js';
import { createClient, RedisClientType } from 'redis';
import Collection from './Collection.js';
import { beforeEach } from 'node:test';
import createCollection from './createCollection.js';
import View from './View.js';

describe('createView', () => {
  let redis: RedisClientType;
  let name: string = 'test_createView';
  let redisKey: string;
  let collection: Collection;

  beforeAll(async () => {
    redis = createClient({ url: 'redis://127.0.0.1:6379' });
    await redis.connect();
    collection = await createCollection(
      name,
      { redis },
      {
        dummy: { id: 'dummy', test: 'dummy' },
      },
    );
    redisKey = collection.redisKey;
  });

  beforeEach(async () => {});

  it('Creates and initializes a new view', async () => {
    const view = await createView(collection);
    expect(view).toBeInstanceOf(View);
  });

  afterEach(async () => {
    await redis.del(redisKey);
  });

  afterAll(async () => {
    await redis.quit();
  });
});
