/**
 * @license
 * MIT License
 *
 * Copyright (c) 2020 Alexis Munsayac
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 *
 * @author Alexis Munsayac <alexis.munsayac@gmail.com>
 * @copyright Alexis Munsayac 2020
 */
import {
  node,
} from 'graph-state';
import {
  createSWRStore,
  MutationResult,
} from 'swr-store';
import {
  SWRGraphNode,
  SWRGraphNodeFetch,
  SWRGraphNodeOptions,
} from './types';
import { getKey } from './utils';

export function swr<S>(
  options: SWRGraphNodeOptions<S>,
): SWRGraphNode<S> {
  const { key, setup, ...swrOptions } = options;

  let fetcher: SWRGraphNodeFetch<S>;

  const store = createSWRStore({
    key: () => getKey(key),
    get: () => fetcher(),

    ...swrOptions,
  });

  const resource = node<MutationResult<S>>({
    key: `SWR[${key}]`,
    get: (context) => {
      const newFetcher = setup(context);

      fetcher = newFetcher;

      context.subscription(() => (
        store.subscribe([], (currentMutation) => {
          context.mutateSelf(currentMutation.result);
        })
      ));

      return store.get([], {
        shouldRevalidate: true,
      });
    },
  });

  return {
    hydrate: (data) => store.mutate([], data),
    subscribe: (listener) => store.subscribe([], (value) => {
      listener(value.result);
    }),
    trigger: (shouldRevalidate = true) => store.trigger([], shouldRevalidate),
    mutate: (data, shouldRevalidate = true) => store.mutate([], data, shouldRevalidate),
    resource,
  };
}

/**
 * @deprecated
 */
export function createSWRGraphNode<S>(
  options: SWRGraphNodeOptions<S>,
): SWRGraphNode<S> {
  return swr(options);
}
