# swr-graph-state

> SWR + `graph-state`

[![NPM](https://img.shields.io/npm/v/swr-graph-state.svg)](https://www.npmjs.com/package/swr-graph-state) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
yarn add graph-state swr-graph-state
```

## Usage

```tsx
import React, { Suspense } from 'react';
import {
  GraphDomain,
  useGraphNodeResource,
} from 'react-graph-state';
import { createGraphNode } from 'graph-state';
import { createSWRGraphNode } from 'swr-graph-state';

const API = 'https://dog.ceo/api/breed/';
const API_SUFFIX = '/images/random';

interface APIResult {
  message: string;
  status: string;
}

const dogBreed = createGraphNode({
  get: 'shiba',
});

const dogAPI = createSWRGraphNode<APIResult>({
  key: 'dogAPI',
  fetch: async ({ get }) => {
    const breed = get(dogBreed);
    const response = await fetch(`${API}${breed}${API_SUFFIX}`);
    return (await response.json()) as APIResult;
  },
  revalidateOnFocus: true,
  revalidateOnNetwork: true,
});

function DogImage(): JSX.Element {
  const data = useGraphNodeResource(dogAPI.resource);

  return <img src={data.message} alt={data.message} />;
}

function Trigger(): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        dogAPI.trigger();
      }}
    >
      Trigger
    </button>
  );
}

export default function App(): JSX.Element {
  return (
    <GraphDomain>
      <Trigger />
      <div>
        <Suspense fallback={<h1>Loading...</h1>}>
          <DogImage />
        </Suspense>
      </div>
    </GraphDomain>
  );
}
```

## Features

### Hydration

SWR node may present an initial data through `options.initialData`. This data is used only when the store finds an empty cache value. Initial data is also useful for opting-out of initial pending phase and providing a way for SSR pages to hydrate nodes.

```ts
const userDetails = createSWRGraphNode({
  key: '/user/details',
  get: () => getUserDetails(),
  initialData: prefetchedData,
});
```

SWR nodes can also be hydrated manually through `hydrate`.

```ts
import { hydrate } from 'swr-graph-node';

// Node hydration
userDetails.hydrate({
  data: {
    name: 'John Doe',
    age: 16,
  },
  status: 'success',
});

// Global hydration
hydrate('/user/details', {
  data: {
    name: 'John Doe',
    age: 16,
  },
  status: 'success',
});
```

### Subscriptions

SWR nodes allows subscriptions to subscribe for cache updates. Subscribing returns a callback that allows unsubscribing to the cache updates.

```ts
// Local subscription
const unsubscribe = userDetails.subscribe((result) => {
  if (result.status === 'pending') {
    displaySkeleton();
  } else if (result.status === 'failure') {
    displayFallback();
  } else if (result.status === 'success') {
    displayUI(result.data);
  }
});

// global subscription
import { subscribe } from 'swr-graph-state';

const unsubscribe = subscribe('/user/details', (result) => {
  if (result.status === 'pending') {
    displaySkeleton();
  } else if (result.status === 'failure') {
    displayFallback();
  } else if (result.status === 'success') {
    displayUI(result.data);
  }
});
```

### Manual Revalidation

SWR nodes have the methods `mutate` and `trigger` which allows manual revalidation of cached data. `mutate` overwrites the cached data while `trigger` prompts for a revalidation.

```ts
const userDetails = createSWRGraphNode({
  key: '/user/details',
  get: () => getUserDetails(),
});

userDetails.trigger();

userDetails.mutate({
  data: {
    name: 'John Doe',
    age: 16,
  },
  status: 'success',
});
```

### Global Revalidation

SWR nodes share the same global cache, and can be prompted with a global manual revalidation. `trigger` and `mutate` are similar to node's `node.trigger` and `node.mutate` except that they accept the cache key first.

Stores subscribers may be notified (`trigger` does not guarantee a notification, while `mutate` guarantees a notification) for the cache update.

```ts
import { trigger, mutate } from 'swr-graph-state';

const userDetails = createSWRGraphNode({
  key: '/user/details',
  get: () => getUserDetails(),
});

// ...
// Global trigger
trigger('/user/details');

// Or mutate
mutate('/user/details', {
  data: {
    name: 'John Doe',
    age: 16,
  },
  status: 'success',
});
```

### Local Revalidation

SWR nodes can be manually revalidated by calling `node.trigger` or `node.mutate`.

- `node.trigger(shouldRevalidate = true)`: Triggers a revalidation from the given arguments. Arguments are passed to `options.key` to locate the cache.
- `node.mutate(result, shouldRevalidate = true)`: Mutates the cache with `result`. Cache is located based on the key generated from the arguments passed to `options.key`.

```ts
// Local revalidation
userDetails.trigger([userId]);

// is the same as 
trigger(`/user/${userId}`);

// Since userDetails yields the same key format.
```

### Auto Revalidation

SWR nodes are able to automatically revalidate data based on DOM events. This feature can be activated based on the following options:

- `options.revalidateOnFocus`: Automatically revalidates data when the window `'focus'` event is triggered. Defaults to `false`.
- `options.revalidateOnVisibility`: Automatically revalidates data when the document `'visibilitychange'` event is triggered, specifically, if the page is `'visible'`. Defaults to `false`.
- `options.revalidateOnNetwork`: Automatically revalidates data when the window `'online'` event is triggered. Defaults to `false`.

### Polling Revalidation

SWR nodes are able to poll for revalidation. They are different to event-based revalidation as polling revalidation happens in intervals.

This behavior can be activated through the following options:

- `options.refreshInterval`: Amount of time (in milliseconds) the revalidation goes through in intervals. Defaults to `undefined` (Does not poll). Polling begins immediately after the lazy setup has been triggered.

The default behavior can be overriden by the following options:

- `options.refreshWhenHidden`: Overrides the default polling behavior and only begins polling after the page becomes hidden (triggered by document `visibilitychange` event.). Once the document becomes visible, polling halts.
- `options.refreshWhenBlurred`: Overrides the default polling behavior and only begins polling after the page loses focus (triggered by window `blur` and `focus` events). Once the page is focused again, polling halts.
- `options.refreshWhenOffline`: Overrides the default polling behavior and only begins polling after the page becomes offline (triggered by window `offline` and `online` events). Once the page is focused again, polling halts.

### Lazy Setup

SWR nodes are lazily setup: polling and automatic revalidation only begins when there are subscribers to the nodes. Once a store receives a subscriber (through `store.subscribe` method), the store lazily sets up the revalidation processes, this way, automatic processes are conserved and are only added when needed.

Stores also halt from automatic revalidation if they lose all subscribers through reference-counting.

### Cache Age

SWR nodes can define how 'fresh' or 'stale' the cache is, which can alter the revalidation behavior:

- If the cache is 'fresh', revalidation phases skips the fetching stage.
- If the cache is 'stale', revalidation phases goes through, but the result does not return to `'pending'` state.

These behavior can be defined through the following options:

- `options.freshAge`: Defines how long the cache stays 'fresh', in milliseconds. Defaults to `2000`. (2 seconds).
- `options.staleAge`: Defines how long the cache stays 'stale' after becoming 'fresh', in milliseconds. Defaults to `30000` (30 seconds).

A cache is 'fresh' when the time between the cache was updated and was read is between the `options.freshAge` value, otherwise, the cache automatically becomes 'stale'.
A cache that has been 'stale' will continue being 'stale' until the time between the cache became 'stale' and was read is between the `options.staleAge`.

Cache invalidation always happen lazily: checking for cache age only happens when the revalidation process is requested upon (usually automatically through polling or revalidation on events) or manually (`mutate` or `trigger`).

### Deduplication

SWR Stores throttles data fetching processes through the caching strategy. Cache maintain a timestamp internally, marking valid requests and cache references, establishing race conditions.

### CSR-Only Revalidation and Fetching

SWR nodes' cache revalidation and data-fetching only happens on client-side.

### Success Bailouts

SWR nodes, by default, deeply compare success data in between cache updates. This behavior prevents re-notifying subscribers when the contents of the data remains the same. This behavior can be overriden by providing a compare function in `options.compare`.

`mutate` accepts an custom compare function to override this behavior as a fourth parameter.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
