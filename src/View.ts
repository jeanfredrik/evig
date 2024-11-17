import EventEmitter from 'node:events';
import Collection from './Collection';
import { Patch as ImmerPatch } from 'immer';
import fromImmerPatch from './fromImmerPatch';
import { Patch } from './types';
import { Document } from './Document';
import { filter, map, omit, pick } from 'ramda';

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
  readonly filter: (doc: TDocument) => boolean;

  constructor(
    collection: TCollection,
    {
      includedFields = [],
      excludedFields = [],
      filter = () => true,
    }: ViewOptions<TDocument> = {},
  ) {
    super();
    this.collection = collection;
    this.collection.on(
      'expandedImmerPatches',
      this.onCollectionPatches.bind(this),
    );
    this.excludedFields = new Set(excludedFields);
    this.includedFields = new Set(includedFields);
    this.filter = filter;
  }

  onCollectionPatches(expandedImmerPatches: ImmerPatch[]) {
    expandedImmerPatches = expandedImmerPatches.filter((patch) =>
      this.isPatchApplicable(patch),
    );
    this.emit('expandedImmerPatches', expandedImmerPatches);

    const expandedPatches = expandedImmerPatches.map(fromImmerPatch);
    this.emit('expandedPatches', expandedPatches);
  }

  isPatchApplicable(patch: ImmerPatch) {
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

  get snapshot(): { [id: string]: TDocument } {
    const viewSnapshot = map(
      (doc) => {
        return this.transformDoc(doc as TDocument);
      },
      filter(
        (doc) => this.filter(doc),
        this.collection.snapshot as { [id: string]: TDocument },
      ),
    ) as { [id: string]: TDocument };
    return viewSnapshot;
  }

  get(id: string): TDocument | undefined {
    const doc = this.collection.get(id) as TDocument;
    return (
      (doc && this.filter(doc) && this.transformDoc(doc as TDocument)) ||
      undefined
    );
  }

  // getId(doc: TDocument) {
  //   return this.collection.getId(doc);
  // }
}
