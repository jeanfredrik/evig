import { EventEmitter } from 'node:events';
import { RedisClientType } from 'redis';
import { Document } from './Document';
import {
  castDraft,
  Draft,
  enablePatches,
  Patch as ImmerPatch,
  produceWithPatches,
} from 'immer';
import queue from './queue';
import expandImmerPatch from './expandImmerPatch';
import { Patch, RedisPatch } from './types';
import fromImmerPatch from './fromImmerPatch';
import toRedisPatches from './toRedisPatches';
import applyRedisPatches from './applyRedisPatches';
import { indexBy, map } from 'ramda';
import parseDoc from './parseDoc';
import stringifyDoc from './stringifyDoc';
import mimic from './mimic';

enablePatches();

export type CollectionEventMap = {
  // insert: Document<'id'>;
  // update: (doc: Document<'id'>, patches: Patch[]) => void;
  // delete: (doc: Document<'id'>) => void;
  immerPatches: [ImmerPatch[]];
  expandedImmerPatches: [ImmerPatch[]];
  patches: [Patch[]];
  expandedPatches: [Patch[]];
  redisPatches: [RedisPatch[]];
};

export type CollectionConstructorOptions = {
  redis: RedisClientType;
  prefix?: string;
};

export default class Collection<
  TDocument extends Document<'id'> = Document<'id'>,
> extends EventEmitter<CollectionEventMap> {
  private redis: RedisClientType;
  readonly name: string;
  readonly prefix: string;
  readonly idKey: 'id';
  private data: { [id: string]: TDocument };

  constructor(
    name: string,
    { redis, prefix = 'evig_' }: CollectionConstructorOptions,
  ) {
    super();
    this.name = name;
    this.redis = redis;
    this.prefix = prefix;
    this.idKey = 'id';
    this.data = {};
    this.on('redisPatches', this.applyRedisPatches);
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
      this.data = newData;
      return { immerPatches };
    });
    const { immerPatches } = (await job.result) as {
      immerPatches: ImmerPatch[];
    };
    this.propagateImmerPatches(immerPatches);
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
      this.data = newData;
      return { immerPatches };
    });
    const { immerPatches } = (await job.result) as {
      immerPatches: ImmerPatch[];
    };
    this.propagateImmerPatches(immerPatches);
  }

  async upsert(id: string, recipe: (draft: Draft<TDocument>) => void) {
    const job = queue.add(async () => {
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        draft[id] ??= { id } as Draft<TDocument>;
        recipe(draft[id]);
      });
      this.data = newData;
      return { immerPatches };
    });
    const { immerPatches } = (await job.result) as {
      immerPatches: ImmerPatch[];
    };
    this.propagateImmerPatches(immerPatches);
  }

  async replaceAll(data: { [id: string]: TDocument } | TDocument[]) {
    if (Array.isArray(data)) {
      data = indexBy((doc) => this.getId(doc), data);
    }
    const job = queue.add(async () => {
      const [newData, immerPatches] = produceWithPatches(this.data, (draft) => {
        mimic(draft, castDraft(data));
      });
      this.data = newData;
      return { immerPatches };
    });
    const { immerPatches } = (await job.result) as {
      immerPatches: ImmerPatch[];
    };
    this.propagateImmerPatches(immerPatches);
  }

  /**
   * Emits events for patches in different formats
   */
  private propagateImmerPatches(immerPatches: ImmerPatch[]) {
    this.emit('immerPatches', immerPatches);

    const expandedImmerPatches = immerPatches.flatMap(expandImmerPatch);
    this.emit('expandedImmerPatches', expandedImmerPatches);

    const patches = immerPatches.map(fromImmerPatch);
    this.emit('patches', patches);

    const expandedPatches = expandedImmerPatches.map(fromImmerPatch);
    this.emit('expandedPatches', expandedPatches);

    const redisPatches = toRedisPatches(patches);
    this.emit('redisPatches', redisPatches);
  }

  private async applyRedisPatches(redisPatches: RedisPatch[]) {
    await applyRedisPatches(this.redis, this.redisKey, redisPatches);
  }
}
