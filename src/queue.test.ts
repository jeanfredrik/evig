import { describe, it, expect } from 'vitest';
import queue from './queue.js';

describe('queue', () => {
  it('Handles throws of non-errors', async () => {
    await expect(
      queue.add(async () => {
        throw 'not an error';
      }).result,
    ).rejects.toThrow('Unknown error');
  });
});
