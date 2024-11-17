export default function parseDoc<TDocument>(value: string): TDocument {
  return JSON.parse(value);
}
