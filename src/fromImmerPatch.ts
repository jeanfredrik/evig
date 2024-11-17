import { Patch as ImmerPatch } from 'immer';
import { Patch } from './types';

export default function fromImmerPatch(immerPatch: ImmerPatch): Patch {
  const { path, ...rest } = immerPatch;
  return { path: path.join('/'), ...rest };
}
