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

### 🚧 UNDER CONSTRUCTION 🚧

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)