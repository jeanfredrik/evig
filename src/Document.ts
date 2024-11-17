export type Document<TIdKey extends string> = { [field: string]: any } & {
  [K in TIdKey]: string;
};
