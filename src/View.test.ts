import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import View from './View';
import createCollection from './createCollection';
import Collection from './Collection';
import { createClient, RedisClientType } from 'redis';

describe('View', () => {
  let redis: RedisClientType;
  let redisKey: string;
  let collection: Collection;
  const collectionName = 'test_view';
  let lastId = 1;
  function nextId() {
    return String(lastId++);
  }

  beforeAll(async () => {
    redis = createClient({ url: 'redis://127.0.0.1:6379' });
    await redis.connect();
    redisKey = (await createCollection(collectionName, { redis })).redisKey;
  });

  beforeEach(async () => {
    await redis.del(redisKey);
    collection = await createCollection(collectionName, { redis });
    redisKey = collection.redisKey;
  });

  it('Acts like its associated collection if no options are provided', async () => {
    const id1 = nextId();
    const id2 = nextId();

    const view = new View(collection);

    const onCollectionPatches = vi.fn();
    const onCollectionImmerPatches = vi.fn();
    const onViewPatches = vi.fn();
    const onViewImmerPatches = vi.fn();

    collection.on('expandedPatches', onCollectionPatches);
    collection.on('expandedImmerPatches', onCollectionImmerPatches);
    view.on('expandedPatches', onViewPatches);
    view.on('expandedImmerPatches', onViewImmerPatches);

    await collection.insert({ id: id1, test: 'one' });

    // Expect the view to have the same docs as the collection
    expect(view.get(id1)).toEqual(collection.get(id1));
    expect(view.get(id2)).toEqual(collection.get(id2)); // Non-existent doc
    expect(view.snapshot).toEqual(collection.snapshot);

    // Expect the view to emit the same patches as the collection
    expect(onViewPatches).toHaveBeenLastCalledWith(
      ...(onCollectionPatches.mock.lastCall || []),
    );

    // Expect the view to emit the same immer patches as the collection
    expect(onViewImmerPatches).toHaveBeenLastCalledWith(
      ...(onCollectionImmerPatches.mock.lastCall || []),
    );

    await collection.update(id1, (draft) => {
      draft.test = 'updated';
    });

    expect(view.snapshot).toEqual(collection.snapshot);

    // Expect the view to emit the same patches as the collection
    expect(onViewPatches).toHaveBeenLastCalledWith(
      ...(onCollectionPatches.mock.lastCall || []),
    );

    // Expect the view to emit the same immer patches as the collection
    expect(onViewImmerPatches).toHaveBeenLastCalledWith(
      ...(onCollectionImmerPatches.mock.lastCall || []),
    );
  });

  it('Removes doc props based on `excludedFields`', async () => {
    const id = nextId();
    const view = new View(collection, { excludedFields: ['secret'] });

    const onViewPatches = vi.fn();
    const onViewImmerPatches = vi.fn();

    view.on('expandedPatches', onViewPatches);
    view.on('expandedImmerPatches', onViewImmerPatches);

    await collection.insert({ id: id, secret: 'two' });

    expect(view.snapshot[id]).toEqual({ id: id });
    expect(view.get(id)).toEqual({ id: id });

    expect(onViewPatches).toHaveBeenLastCalledWith([
      {
        op: 'add',
        path: id,
        value: {},
      },
      {
        op: 'add',
        path: `${id}/id`,
        value: id,
      },
    ]);

    expect(onViewImmerPatches).toHaveBeenLastCalledWith([
      {
        op: 'add',
        path: [id],
        value: {},
      },
      {
        op: 'add',
        path: [id, 'id'],
        value: id,
      },
    ]);
  });

  it('Removes doc props based on `includedFields`', async () => {
    const id = nextId();
    const view = new View(collection, { includedFields: ['name'] });

    const onViewPatches = vi.fn();
    const onViewImmerPatches = vi.fn();

    view.on('expandedPatches', onViewPatches);
    view.on('expandedImmerPatches', onViewImmerPatches);

    await collection.insert({ id, secret: 'test', name: 'test' });

    expect(view.snapshot[id]).toEqual({ id, name: 'test' });
    expect(view.get(id)).toEqual({ id, name: 'test' });

    expect(onViewImmerPatches).toHaveBeenLastCalledWith([
      {
        op: 'add',
        path: [id],
        value: {},
      },
      {
        op: 'add',
        path: [id, 'id'],
        value: id,
      },
      {
        op: 'add',
        path: [id, 'name'],
        value: 'test',
      },
    ]);

    expect(onViewPatches).toHaveBeenLastCalledWith([
      {
        op: 'add',
        path: id,
        value: {},
      },
      {
        op: 'add',
        path: `${id}/id`,
        value: id,
      },
      {
        op: 'add',
        path: `${id}/name`,
        value: 'test',
      },
    ]);
  });

  it('Excludes docs based in `filter`', async () => {
    let id1 = nextId();
    let id2 = nextId();
    const view = new View(collection, {
      filter: (doc) => !doc.secret,
    });

    const onViewPatches = vi.fn();
    const onViewImmerPatches = vi.fn();

    view.on('expandedPatches', onViewPatches);
    view.on('expandedImmerPatches', onViewImmerPatches);

    await collection.insert({ id: id1, test: 'one', secret: true });
    await collection.insert({ id: id2, test: 'two', secret: false });

    expect(view.snapshot[id1]).toBeUndefined();
    expect(view.get(id1)).toBeUndefined();
    expect(view.snapshot[id2]).toEqual({ id: id2, test: 'two', secret: false });
    expect(view.get(id2)).toEqual({ id: id2, test: 'two', secret: false });

    expect(onViewImmerPatches).toHaveBeenLastCalledWith([
      {
        op: 'add',
        path: [id2],
        value: {},
      },
      {
        op: 'add',
        path: [id2, 'id'],
        value: id2,
      },
      {
        op: 'add',
        path: [id2, 'test'],
        value: 'two',
      },
      {
        op: 'add',
        path: [id2, 'secret'],
        value: false,
      },
    ]);
  });

  afterAll(async () => {
    await redis.del(redisKey);
  });
});
