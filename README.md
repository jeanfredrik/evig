# Evig

A persistent document database that emits JSON patches.

## API

### `createCollection()`

```ts
import { createClient } from 'redis';
import { createCollection } from 'evig';

const redis = createClient({ url: 'redis://127.0.0.1:6379' });
await redis.connect();

const usersCollection = await createCollection('users', { redis });

usersCollection.on('patches', (patches) => {
  console.log(patches);
});

await usersCollection.insert({ id: '123', name: 'Alice' });
// Console: [{ op: 'add', path: '123', value: { id: '123', name: 'Alice' } }]

await usersCollection.insert({ id: '456', name: 'Bob' });
// Console: [{ op: 'add', path: '456', value: { id: '456', name: 'Bob' } }]

const alice = usersCollection.get('123');
```

### `createView()`

```ts
const aliceView = await createView(usersCollection, {
  filter: (doc) => doc.name === 'Alice',
});

console.log(aliceView.snapshot);
// Console: { '123': { id: '123', name: 'Alice' } }
```
