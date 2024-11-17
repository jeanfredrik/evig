// export type AddPatch<T = any> = {
//   op: 'add';
//   path: string;
//   value: T;
// };

// export type ReplacePatch<T = any> = {
//   op: 'replace';
//   path: string;
//   value: T;
// };

// export type RemovePatch = {
//   op: 'remove';
//   path: string;
// };

export { Patch as ImmerPatch } from 'immer';

export type Patch = {
  op: 'replace' | 'remove' | 'add';
  path: string;
  value?: any;
};

export type RedisPatch = {
  op: 'set' | 'del' | 'patch';
  field: string;
  value?: any;
  patch?: Patch;
};
