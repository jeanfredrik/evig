import Collection, { CollectionConstructorOptions } from './Collection';
import { Document } from './Document';

export default async function createCollection<
  TDocument extends Document<'id'> = Document<'id'>,
>(
  name: string,
  options: CollectionConstructorOptions,
  ...initArgs: Parameters<Collection<TDocument>['init']>
) {
  const collection = new Collection<TDocument>(name, options);
  await collection.init(...initArgs);
  return collection;
}
