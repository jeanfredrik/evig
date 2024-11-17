import { Document } from './Document.js';

export default function stringifyDoc(value: Document<string>): string {
  return JSON.stringify(value);
}
