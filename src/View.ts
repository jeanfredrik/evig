import EventEmitter from 'node:events';
import Collection from './Collection.js';
import { Draft, Patch as ImmerPatch, produceWithPatches } from 'immer';
import fromImmerPatch from './fromImmerPatch.js';
import { Patch } from './types.d.js';
import { Document } from './Document.js';
import { filter, map, omit, pick } from 'ramda';
import mimic from './mimic.js';
import expandImmerPatch from './expandImmerPatch.js';

export type ViewEventMap = {
  // insert: Document<'id'>;
  // update: (doc: Document<'id'>, patches: Patch[]) => void;
  // delete: (doc: Document<'id'>) => void;
  // immerPatches: [ImmerPatch[]];
  expandedImmerPatches: [ImmerPatch[]];
  // patches: [Patch[]];
  expandedPatches: [Patch[]];
};

export type ViewOptions<
  // TCollection extends Collection<TDocument>,
  TDocument extends Document<'id'> = Document<'id'>,
> = {
  maxListeners?: number;
  includedFields?: string[];
  excludedFields?: string[];
  filter?: (doc: TDocument) => boolean;
};

export default class View<
  TCollection extends Collection<TDocument>,
  TDocument extends Document<'id'> = Document<'id'>,
> extends EventEmitter {
  readonly collection: TCollection;
  readonly excludedFields: Set<string>;
  readonly includedFields: Set<string>;
  readonly filter?: (doc: TDocument) => boolean;

  constructor(
    collection: TCollection,
    {
      maxListeners = 0,
      includedFields = [],
      excludedFields = [],
      filter,
    }: ViewOptions<TDocument> = {},
  ) {
    super();
    this.collection = collection;
    this.collection.on(
      'expandedImmerPatchesWithSnapshot',
      this.onCollectionPatches.bind(this),
    );
    this.excludedFields = new Set(excludedFields);
    this.includedFields = new Set(includedFields);
    this.filter = filter;
    this.setMaxListeners(maxListeners);
  }

  private onCollectionPatches(
    expandedImmerPatches: ImmerPatch[],
    newSnapshot: {
      [id: string]: TDocument;
    },
    oldSnapshot: { [id: string]: TDocument },
  ) {
    expandedImmerPatches = this.filter
      ? this.transformPatches(expandedImmerPatches, newSnapshot, oldSnapshot)
      : expandedImmerPatches.filter((patch) => this.isPatchApplicable(patch));
    if (expandedImmerPatches.length === 0) {
      return;
    }
    this.emit('expandedImmerPatches', expandedImmerPatches);

    const expandedPatches = expandedImmerPatches.map(fromImmerPatch);
    this.emit('expandedPatches', expandedPatches);
  }

  private transformPatches(
    _patches: ImmerPatch[], // Kept for future use
    newSnapshot: {
      [id: string]: TDocument;
    },
    oldSnapshot: { [id: string]: TDocument },
  ): ImmerPatch[] {
    const newViewSnapshot = this.transformSnapshot(newSnapshot);
    const oldViewSnapshot = this.transformSnapshot(oldSnapshot);
    const [, transformedPatches] = produceWithPatches(
      oldViewSnapshot,
      (draft) => {
        mimic(draft, newViewSnapshot as Draft<TDocument>);
      },
    );
    return transformedPatches.flatMap(expandImmerPatch);
  }

  private isPatchApplicable(patch: ImmerPatch) {
    const field = patch.path[1] as string;
    if (field && this.excludedFields.has(field)) {
      return false;
    }
    if (
      field &&
      field !== this.collection.idKey &&
      this.includedFields.size > 0 &&
      !this.includedFields.has(field)
    ) {
      return false;
    }
    return true;
  }

  private transformDoc(doc: TDocument): TDocument {
    return omit(
      [...this.excludedFields],
      this.includedFields.size > 0
        ? (pick(
            [this.collection.idKey, ...this.includedFields],
            doc,
          ) as TDocument)
        : doc,
    ) as TDocument;
  }

  private transformSnapshot(snapshot: { [id: string]: TDocument }) {
    return map(
      (doc) => {
        return this.transformDoc(doc as TDocument);
      },
      filter(this.filter ? (doc) => this.filter!(doc) : () => true, snapshot),
    ) as { [id: string]: TDocument };
  }

  get snapshot(): { [id: string]: TDocument } {
    return this.transformSnapshot(this.collection.snapshot);
  }

  get(id: string): TDocument | undefined {
    const doc = this.collection.get(id) as TDocument;
    return (
      (doc &&
        (!this.filter || this.filter(doc)) &&
        this.transformDoc(doc as TDocument)) ||
      undefined
    );
  }

  // getId(doc: TDocument) {
  //   return this.collection.getId(doc);
  // }
}
