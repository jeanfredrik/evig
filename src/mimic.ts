import isPlainObject from './isPlainObject.js';

/**
 * Makes the minimal set of changes to `source` to make it equal to `target`.
 * @returns {void}
 */
export default function mimic<T extends Record<string | number, any>>(
  source: T,
  target: T,
): void {
  let sourceKeys = new Set(Object.keys(source));
  for (const key in target) {
    sourceKeys.delete(key);
    if (!isPlainObject(target[key]) || !isPlainObject(source[key])) {
      source[key] = target[key];
    } else {
      mimic(source[key], target[key]);
    }
  }
  for (const key of sourceKeys) {
    delete source[key];
  }
}
