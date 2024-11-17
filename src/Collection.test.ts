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

import Collection from './Collection';

describe('Collection', () => {
  let redis: RedisClientType;
  let redisKey: string;

  beforeAll(async () => {
    redis = createClient({ url: 'redis://127.0.0.1:6379' });
    await redis.connect();
    redisKey = new Collection('test', { redis }).redisKey;
    await redis.hSet(
      redisKey,
      'dummy',
      JSON.stringify({ id: 'dummy', name: 'dummy' }),
    );
  });

  it('inserts a new document', async () => {
    const collection = new Collection('test', { redis });
    const doc = { id: '1', name: 'test' };
    await collection.insert(doc);
    const insertedDoc = collection.get(doc.id);
    expect(insertedDoc).toEqual(doc);
  });

  it('throws when inserting an existing document', async () => {
    const collection = new Collection('test', { redis });
    const doc = { id: 'dummy', name: 'test' };
    await collection.insert(doc);
    await expect(collection.insert(doc)).rejects.toThrow(
      `Document with id "${doc.id}" already exists`,
    );
    const insertedDoc = collection.get(doc.id);
    expect(insertedDoc).toEqual(doc);
  });

  it('updates an exiting document', async () => {
    const collection = new Collection('test', { redis });
    const doc = { id: 'dummy', name: 'test' };
    await collection.insert(doc);
    await collection.update(doc.id, (draft) => {
      draft.name = 'updated';
    });
    const updatedDoc = collection.get(doc.id);
    expect(updatedDoc).toEqual({ id: 'dummy', name: 'updated' });
  });

  it('throws when updating a missing document', async () => {
    const collection = new Collection('test', { redis });
    await expect(collection.update('dummy', () => {})).rejects.toThrow(
      'Document with id "dummy" does not exist',
    );
  });

  it('runs multiple updates in the correct order', async () => {
    const collection = new Collection('test', { redis });
    const doc = { id: 'dummy', name: 'test', foo: 0, bar: 0, baz: 0 };
    await collection.insert(doc);
    await Promise.all([
      collection.update(doc.id, (draft) => {
        draft.foo = 1;
      }),
      collection.update(doc.id, (draft) => {
        draft.bar = draft.foo + 1;
      }),
      collection.update(doc.id, (draft) => {
        draft.baz = draft.bar + 1;
      }),
    ]);
    const updatedDoc = collection.get(doc.id);
    expect(updatedDoc).toEqual({
      id: 'dummy',
      name: 'test',
      foo: 1,
      bar: 2,
      baz: 3,
    });
  });

  it('upserts a new document', async () => {
    const collection = new Collection('test', { redis });
    const id = '1';
    await collection.upsert(id, (draft) => {
      draft.name = 'test';
    });
    const insertedDoc = collection.get(id);
    expect(insertedDoc).toEqual({ id, name: 'test' });
  });

  it('upserts an existing document', async () => {
    const collection = new Collection('test', { redis });
    const doc = { id: 'dummy', name: 'test' };
    await collection.insert(doc);
    await collection.upsert(doc.id, (draft) => {
      draft.name = 'updated';
    });
    const updatedDoc = collection.get(doc.id);
    expect(updatedDoc).toEqual({ id: 'dummy', name: 'updated' });
  });

  afterAll(async () => {
    // await redis.quit();
  });
});
