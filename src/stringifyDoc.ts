import { Document } from './Document';

export default function stringifyDoc(value: Document<string>): string {
  return JSON.stringify(value);
}
