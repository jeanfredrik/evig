import Collection from './Collection';
import { Document } from './Document';
import View, { ViewOptions } from './View';

export default async function createView<
  TDocument extends Document<'id'> = Document<'id'>,
>(collection: Collection<TDocument>, options: ViewOptions = {}) {
  const view = new View(collection, options);
  return view;
}
