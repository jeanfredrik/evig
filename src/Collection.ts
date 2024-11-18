import { EventEmitter } from 'node:events';
import { RedisClientType } from 'redis';
import { Document } from './Document.js';
import {
  castDraft,
  Draft,
  enablePatches,
  Patch as ImmerPatch,
  produceWithPatches,
} from 'immer';
import queue from './queue.js';
import expandImmerPatch from './expandImmerPatch.js';
import { Patch, RedisPatch } from './types.d.js';
import fromImmerPatch from './fromImmerPatch.js';
import toRedisPatches from './toRedisPatches.js';
import applyRedisPatches from './applyRedisPatches.js';
import { indexBy, map } from 'ramda';
import parseDoc from './parseDoc.js';
import stringifyDoc from './stringifyDoc.js';
import mimic from './mimic.js';

enablePatches();

export type CollectionEventMap<TDocument extends Document<'id'>> = {
  // insert: Document<'id'>;
  // update: (doc: Document<'id'>, patches: Patch[]) => void;
  // delete: (doc: Document<'id'>) => void;
  immerPatches: [ImmerPatch[]];
  immerPatchesWithSnapshot: [
    ImmerPatch[],
    { [id: string]: TDocument },
    { [id: string]: TDocument },
  ];
  expandedImmerPatches: [ImmerPatch[]];
  expandedImmerPatchesWithSnapshot: [
    ImmerPatch[],
    { [id: string]: TDocument },
    { [id: string]: TDocument },
  ];
  patches: [Patch[]];
  patchesWithSnapshot: [
    Patch[],
    { [id: string]: TDocument },
    { [id: string]: TDocument },
  ];
  expandedPatches: [Patch[]];
  expandedPatchesWithSnapshot: [
    Patch[],
    { [id: string]: TDocument },
    { [id: string]: TDocument },
  ];
  redisPatches: [RedisPatch[]];
  redisPatchesWithSnapshot: [
    RedisPatch[],
    { [id: string]: TDocument },
    { [id: string]: TDocument },
  ];
};

export type CollectionConstructorOptions = {
  redis: RedisClientType;
  prefix?: string;
  maxListeners?: number;
};
export type CollectionOptions = CollectionConstructorOptions;

export default class Collection<
  TDocument extends Document<'id'> = Document<'id'>,
> extends EventEmitter<CollectionEventMap<TDocument>> {
  private redis: RedisClientType;
  readonly name: string;
  readonly prefix: string;
  readonly idKey: 'id';
  private data: { [id: string]: TDocument };

  constructor(
    name: string,
    { redis, prefix = 'evig_', maxListeners = 0 }: CollectionConstructorOptions,
  ) {
    super();
    this.name = name;
    this.redis = redis;
    this.prefix = prefix;
    this.idKey = 'id';
    this.data = {};
    this.on('redisPatches', this.applyRedisPatches);
    this.setMaxListeners(maxListeners);
  }

  async loadFromRedis() {
    const exists = await this.redis.exists(this.redisKey);
    if (exists) {
      const redisData = (await this.redis.hGetAll(this.redisKey)) as {
        [id: string]: string;
      };
      const data = map(parseDoc<TDocument>, redisData);
      this.data = data;
    }
    return exists;
  }

  // async init(): Promise<void>;
  // async init(defaultData: TDocument[]): Promise<void>;
  // async init(defaultData: { [id: string]: TDocument }): Promise<void>;
  async init(
    defaultData?: { [id: string]: TDocument } | TDocument[],
  ): Promise<void> {
    const exists = await this.loadFromRedis();
    if (exists) {
      return;
    }
    if (defaultData) {
      if (Array.isArray(defaultData)) {
        defaultData.forEach((doc) => {
          this.data[this.getId(doc)] = doc;
        });
      } else {
        this.data = defaultData;
      }
      await this.redis.hSet(this.redisKey, map(stringifyDoc, this.data));
    }
  }

  get redisKey() {
    return this.prefix + this.name;
  }

  getId(doc: TDocument): string {
    return doc[this.idKey];
  }

  // getRedisKey(key: string) {
  //   return this.redisKey + ':' + key;
  // }

  // async get(id: string): Promise<Document | null> {
  //   const redisKey = this.getRedisKey(id);
  //   const doc = await this.redis.hGetAll(redisKey);
  //   return doc;
  // }

  get(id: string): TDocument | undefined {
    return this.data[id] || undefined;
  }

  get snapshot(): { [id: string]: TDocument } {
    return this.data;
  }

  async insert(doc: TDocument) {
    const job = queue.add(async () => {
      const id = this.getId(doc);
      const existingDoc = this.get(id);
      if (existingDoc) {
        throw new Error(
          `Document with id "${id}" already exists on ${this.name}`,
        );
      }
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        draft[id] = doc as Draft<TDocument>;
      });
      const snapshot = this.data;
      this.data = newData;
      return { immerPatches, snapshot };
    });
    const { immerPatches, snapshot } = (await job.result) as {
      immerPatches: ImmerPatch[];
      snapshot: { [id: string]: TDocument };
    };
    this.propagateImmerPatches(immerPatches, this.data, snapshot);
  }

  async update(id: string, recipe: (draft: Draft<TDocument>) => void) {
    const job = queue.add(async () => {
      const existingDoc = this.get(id);
      if (!existingDoc) {
        throw new Error(
          `Document with id "${id}" does not exist on ${this.name}`,
        );
      }
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        recipe(draft[id]);
      });
      const snapshot = this.data;
      this.data = newData;
      return { immerPatches, snapshot };
    });
    const { immerPatches, snapshot } = (await job.result) as {
      immerPatches: ImmerPatch[];
      snapshot: { [id: string]: TDocument };
    };
    this.propagateImmerPatches(immerPatches, this.data, snapshot);
  }

  async upsert(id: string, recipe: (draft: Draft<TDocument>) => void) {
    const job = queue.add(async () => {
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        draft[id] ??= { id } as Draft<TDocument>;
        recipe(draft[id]);
      });
      const snapshot = this.data;
      this.data = newData;
      return { immerPatches, snapshot };
    });
    const { immerPatches, snapshot } = (await job.result) as {
      immerPatches: ImmerPatch[];
      snapshot: { [id: string]: TDocument };
    };
    this.propagateImmerPatches(immerPatches, this.data, snapshot);
  }

  async remove(id: string) {
    const job = queue.add(async () => {
      const existingDoc = this.get(id);
      if (!existingDoc) {
        throw new Error(
          `Document with id "${id}" does not exist on ${this.name}`,
        );
      }
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        delete draft[id];
      });
      const snapshot = this.data;
      this.data = newData;
      return { immerPatches, snapshot };
    });
    const { immerPatches, snapshot } = (await job.result) as {
      immerPatches: ImmerPatch[];
      snapshot: { [id: string]: TDocument };
    };
    this.propagateImmerPatches(immerPatches, this.data, snapshot);
  }

  async replaceAll(data: { [id: string]: TDocument } | TDocument[]) {
    if (Array.isArray(data)) {
      data = indexBy((doc) => this.getId(doc), data);
    }
    const job = queue.add(async () => {
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        mimic(draft, castDraft(data));
      });
      const snapshot = this.data;
      this.data = newData;
      return { immerPatches, snapshot };
    });
    const { immerPatches, snapshot } = (await job.result) as {
      immerPatches: ImmerPatch[];
      snapshot: { [id: string]: TDocument };
    };
    this.propagateImmerPatches(immerPatches, this.data, snapshot);
  }

  /**
   * Emits events for patches in different formats
   */
  private propagateImmerPatches(
    immerPatches: ImmerPatch[],
    newSnapshot: { [id: string]: TDocument },
    oldSnapshot: { [id: string]: TDocument },
  ) {
    this.emit('immerPatches', immerPatches);
    this.emit(
      'immerPatchesWithSnapshot',
      immerPatches,
      newSnapshot,
      oldSnapshot,
    );

    const expandedImmerPatches = immerPatches.flatMap(expandImmerPatch);
    this.emit('expandedImmerPatches', expandedImmerPatches);
    this.emit(
      'expandedImmerPatchesWithSnapshot',
      expandedImmerPatches,
      newSnapshot,
      oldSnapshot,
    );

    const patches = immerPatches.map(fromImmerPatch);
    this.emit('patches', patches);
    this.emit('patchesWithSnapshot', patches, newSnapshot, oldSnapshot);

    const expandedPatches = expandedImmerPatches.map(fromImmerPatch);
    this.emit('expandedPatches', expandedPatches);
    this.emit(
      'expandedPatchesWithSnapshot',
      expandedPatches,
      newSnapshot,
      oldSnapshot,
    );

    const redisPatches = toRedisPatches(patches);
    this.emit('redisPatches', redisPatches);
    this.emit(
      'redisPatchesWithSnapshot',
      redisPatches,
      newSnapshot,
      oldSnapshot,
    );
  }

  private async applyRedisPatches(redisPatches: RedisPatch[]) {
    await applyRedisPatches(this.redis, this.redisKey, redisPatches);
  }
}
