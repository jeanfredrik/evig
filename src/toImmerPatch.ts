import { Patch as ImmerPatch } from 'immer';
import { Patch } from './types.d.js';

export default function toImmerPatch(patch: Patch): ImmerPatch {
  const { path, ...rest } = patch;
  return { path: path.split('/'), ...rest };
}
