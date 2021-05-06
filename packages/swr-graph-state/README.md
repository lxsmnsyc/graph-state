# swr-graph-state

> `swr-store` + `graph-state`

[![NPM](https://img.shields.io/npm/v/swr-graph-state.svg)](https://www.npmjs.com/package/swr-graph-state) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)[![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?style=flat-square&logo=codesandbox)](https://codesandbox.io/s/github/LXSMNSYC/graph-state/tree/main/examples/react-swr-Agraph-state)

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
import { node } from 'graph-state';
import { swr } from 'swr-graph-state';

const API = 'https://dog.ceo/api/breed/';
const API_SUFFIX = '/images/random';

interface APIResult {
  message: string;
  status: string;
}

const dogBreed = node({
  get: 'shiba',
});

const dogAPI = swr<APIResult>({
  key: 'dogAPI',
  setup: ({ get }) => {
    const breed = get(dogBreed);
    return async () => {
      const response = await fetch(`${API}${breed}${API_SUFFIX}`);
      return (await response.json()) as APIResult;
    };
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
const userDetails = swr({
  key: '/user/details',
  setup: () => () => getUserDetails(),
  initialData: prefetchedData,
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
const userDetails = swr({
  key: '/user/details',
  setup: () => () => getUserDetails(),
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

const userDetails = swr({
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

### Other features

Most features of `swr-graph-state` is adapted from [`swr-store`](https://github.com/lxsmnsyc/swr-store) so be sure to check it out. Options for both `swr` and `swrFactory` are also derived from it (with the exception of `setup` and `key`).

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
