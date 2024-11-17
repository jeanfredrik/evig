import Collection from './Collection.js';
import { Document } from './Document.js';
import View, { ViewOptions } from './View.js';

export default async function createView<
  TDocument extends Document<'id'> = Document<'id'>,
>(collection: Collection<TDocument>, options: ViewOptions = {}) {
  const view = new View(collection, options);
  return view;
}
