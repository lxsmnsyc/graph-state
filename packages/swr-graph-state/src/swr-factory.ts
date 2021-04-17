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
  factory,
} from 'graph-state';
import {
  createSWRStore,
  MutationResult,
} from 'swr-store';
import {
  SWRGraphNodeFactory,
  SWRGraphNodeFactoryOptions,
  SWRGraphNodeFetch,
} from './types';
import { ensure, getKey } from './utils';

export function swrFactory<S, P extends any[] = []>(
  options: SWRGraphNodeFactoryOptions<S, P>,
): SWRGraphNodeFactory<S, P> {
  const { key, setup, ...swrOptions } = options;

  const fetcher = new Map<string, SWRGraphNodeFetch<S>>();

  const store = createSWRStore<S, P>({
    key: (...args) => getKey(key(...args)),
    get: (...args) => ensure(fetcher.get(key(...args)))(),

    ...swrOptions,
  });

  const resource = factory<MutationResult<S>, P>({
    factoryKey: options.factoryKey,
    key: (...args) => `SWR[${key(...args)}]`,
    get: (...args) => {
      const currentKey = key(...args);
      const currentSetup = setup(...args);
      return (context) => {
        const newFetcher = currentSetup(context);

        fetcher.set(currentKey, newFetcher);

        context.subscription(() => (
          store.subscribe(args, (currentMutation) => {
            context.mutateSelf(currentMutation.result);
          })
        ));

        return store.get(args, {
          shouldRevalidate: true,
        });
      };
    },
  });

  return {
    hydrate: (args, data) => store.mutate(args, data),
    subscribe: (args, listener) => store.subscribe(args, (value) => {
      listener(value.result);
    }),
    trigger: (args, shouldRevalidate = true) => (
      store.trigger(args, shouldRevalidate)
    ),
    mutate: (args, data, shouldRevalidate = true) => (
      store.mutate(args, data, shouldRevalidate)
    ),
    resource,
  };
}

/**
 * @deprecated
 */
export function createSWRGraphNodeFactory<S, P extends any[] = []>(
  options: SWRGraphNodeFactoryOptions<S, P>,
): SWRGraphNodeFactory<S, P> {
  return swrFactory(options);
}
