# graph-state

> Digraph-based state management

[![NPM](https://img.shields.io/npm/v/graph-state.svg)](https://www.npmjs.com/package/graph-state) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
yarn add graph-state
```

```bash
npm install graph-state
```

## Usage

## Features

### Think atomically

`graph-state` motivates the use of granular stores, or we call them "nodes", that is, nodes that only store a single state.

```tsx
import { createGraphNode } from 'graph-state';

// A simple graph node usage
const counter = createGraphNode({
  get: 0,
});
```

Nodes can have either a constant value as a default state, or provide a function that lazily computes the default state.

```tsx
const randomState = createGraphNode({
  get: () => Math.random(),
});
```

### Dependency graph states

`graph-state` leverages the cumbersome process of connecting stores to communicate one another by seamlessly connecting them. A node's `get` propery receives an interface which can be used to read other node's state. Once a node reads another node's value, the read node becomes a "dependency": whenever the dependency node updates value, the dependent node recomputes it's state.

```tsx
const greeting = createGraphNode({
  get: 'Hello',
});

const person = createGraphNode({
  get: 'John Doe',
});

const message = createGraphNode({
  get: ({ get }) => {
    // Read the greeting and person nodes
    const greetingValue = get(greeting);
    const personValue = get(person);

    // When greeting or person updates their state
    // message re-runs its get function to create a new state.

    // Return the derived state
    return `${greetingValue}, ${personValue}.`;
  },
});
```

It doesn't matter when `get` is called or how it is used:

```tsx
const example = createGraphNode({
  get: ({ get } => {
    const cond = get(A);

    if (cond) {
      return get(B); // If A is truthy, B becomes a dependency.
    }
    return get(C); // Otherwise, C becomes the dependency instead of B.
  }),
});
```

Whenever `get` is called, the dependency list is rebuilt, so the timing doesn't matter for a node to become a dependency.

### Lazy Evaluation

Nodes, even though can be created on any level of context, does not evaluate until needed/used.

```tsx
const example = createGraphNode({
  // This function does not run until
  // example is read.
  get: () => runExpensiveComputation(),
});
```

### Keys

Nodes may accept a `key` field:

```tsx
const example = createGraphNode({
  key: 'example',
  get: 'Hello',
});
```

If another node of the same key is attempted to be created, the first instance is always reused.

### Subscriptions

`graph-state` allows managing subscriptions for side-effects. This is useful for subscribing to events (e.g. `addEventListener`), timers (`setTimeout`), etc.

```tsx
const timer = createGraphNode({
  get: ({ subscription }) => {
    subscription(() => {
      const timeout = setTimeout(() => {
        intervalLogic();
      }, 1000);
      return () => {
        clearTimeout(timeout);
      };
    });
  },
});
```

Similar to `get`, it doesn't matter when `subscription` is called. Every recomputation runs the cleanup function returned by `subscription`, and re-runs the callback.

### Mutations

There are two kinds of state update in `graph-state`: `mutate` and `set`. `mutate` directly changes a node's state. `set`'s default behavior is similar to `mutate`, but if the node has a custom `set` function, the custom function is called instead of `mutate`. This is useful for building actions.

Both `get` and `set` received interfaces has functions that allow mutation.

```tsx
// A node that mutates itself.
const secondClock = createGraphNode({
  get: ({ mutateSelf, subscription }) => {
    subscription(() => {
      // an internal variable that tracks a state.
      let count = 0;

      // Subscribe to an interval timer
      const timeout = setInterval(() => {
        // Update our counter
        count += 1;

        // Perform self-mutation
        mutateSelf(count);
      }, 1000);

      return () => {
        clearInterval(timeout);
      };
    });

    return 0;
  },
});
```

### Actions

Inspired by Redux and Flux architecture, nodes can have an action-receiving function called `set`, which overrides the state mutation of the node. The `set` function accepts the same interface as `get` (excluding `subscription`) and the action being received. In contrast with `get`, `set` does not react nor connect to read nodes.

An example of a graph node emulating a Redux store.

```tsx
const counter = createGraphNode({
  get: 0,
});

const reduce = (state, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return state + 1;
    case 'DECREMENT':
      return state - 1;
    default:
      return state;
  }
};

const reducer = createGraphNode({
  get: ({ get }) => get(counter),

  set: ({ get, set }, action) => {
    set(counter, reduce(get(counter), action));
  },
});
```

### Concurrency

Nodes with asynchronous `get` or `set` may produce unwanted side-effects whenever both methods run immediately after one another. To fix this, nodes, internally, have built-in race conditions which allows further side-effects from occuring by preventing `set`, `mutate`, `setSelf`, `mutateSelf` and `subscription` from further evaluation.

```tsx
const itemsList = createGraphNode({
  get: async () => {
    const data = await db.query();
    return data;
  },
});

const filteredItemsList = createGraphNode({
  get: async ({ get }) => {
    // Read itemsList
    const currentList = await get(itemsList);
  
    subscription(() => {
      // This will not run if itemsList emits a new result immediately
      // before the previous result resolves.
      runListSideEffect(currentList);
    });

    return applyFilter(currentList);
  },
}); 
```

Nodes also accept a `resolve` method from interface which wraps a given Promise such that it will only resolve if the node has not yet recomputed.

```tsx
const filteredItemsList = createGraphNode({
  get: async ({ get, resolve }) => {
    // Read itemsList
    const currentList = await get(itemsList);
  
    subscription(() => {
      // This will not run if itemsList emits a new result immediately
      // before the previous result resolves.
      runListSideEffect(currentList);
    });

    // Prevent from resolving if recomputed
    return resolve(applyFilter(currentList));
  },
}); 
```

Nodes that return a Promise may also be converted into an ADT node which emits the stateful representation of the Promise result by using `createGraphNodeResource`. The resource node emits an object with the following fields:

- `status`: The status of the Promise result. Begins with `"pending"`, and changes to either `"success"` or `"failure"`.
- `data`: Value being represented by `status`.
  - if `status === "success"`, `data` is the resolved value.
  - if `status === "failure"`, `data` is the rejected value.
  - if `status === "pending"`, `data` is the resolving Promise instance.

```tsx
const listResource = createGraphNodeResource(itemsList);

const example = createGraphNode({
  get: ({ get }) => {
    const { status, data } = get(listResource);

    // ...
  },
});
```

A valid resource node can be reverted back to a promise using `fromPromise`.

Multiple resources can be concurrently handled using `waitForAll` or `waitForAny`, which correspondingly behaves similarly to `Promise.all` and `Promise.race`.

```tsx
const [name, age, email] = get(waitForAll([
  nameResource,
  ageResource,
  emailResource,
]));
```

### Factory

For producing multiple nodes with the same core logic but varying values, we can use `createGraphNodeFactory`:

```tsx
const nameFactory = createGraphNodeFactory({
  // Similar to individual nodes except dynamic
  key: (id) => `/profile/name/${id}`,
  
  get: (id) => () => readProfileName(id),
});

// ...
const name = get(nameFactory(id));
```

`createGraphNodeFactory` produces a function that passes the arguments provided to `key`, `get` and `set`.

```tsx
const updateName = createGraphNodeFactory({
  key: (id) => `/profile/name/${id}/update`,

  set: (id, defaultName) => ({ set }, name) => {
    set(nameFactory(id), name ?? defaultName);
  },
});

//...
set(updateName(id, 'John Doe'), newName);
```

If a factory returns a Promise, this factory can be wrapped with `createGraphNodeResourceFactory` to produce resource nodes.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
