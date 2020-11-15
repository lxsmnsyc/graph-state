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
  createGraphNode,
  GraphNodeAsyncResult,
} from 'graph-state';
import {
  getMutation,
  setMutation,
  MutationResult,
} from './cache/mutation-cache';
import {
  addRevalidationListener,
  removeRevalidationListener,
  getRevalidation,
  setRevalidation,
} from './cache/revalidation-cache';
import DEFAULT_OPTIONS from './core/default-options';
import registerRevalidation from './core/register-revalidation';
import {
  hydrate,
  mutate,
  subscribe,
  trigger,
} from './global';
import {
  SWRGraphNodeFullOptions,
  SWRGraphNodeInterface,
  SWRGraphNodeOptions,
} from './types';
import IS_CLIENT from './utils/is-client';
import NEVER_PROMISE from './utils/never-promise';

export default function createSWRGraphNode<T>(
  options: SWRGraphNodeOptions<T>,
): SWRGraphNodeInterface<T> {
  const fullOptions: SWRGraphNodeFullOptions<T> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  registerRevalidation(fullOptions.key, fullOptions, fullOptions.refreshInterval);

  const { key, initialData } = fullOptions;

  // This is a graph node that manages
  // the revalidation state of the resource node.
  const revalidateNode = createGraphNode<boolean>({
    key: `SWR.Revalidate[${key}]`,
    get: ({ mutateSelf, subscription }) => {
      subscription(() => {
        addRevalidationListener(key, mutateSelf);
        return () => {
          removeRevalidationListener(key, mutateSelf);
        };
      });

      return !!getRevalidation(key);
    },
  });

  const { freshAge, staleAge } = fullOptions;

  const resource = createGraphNode<GraphNodeAsyncResult<T>>({
    key: `SWR[${key}]`,
    get: (methods) => {
      const shouldRevalidate = methods.get(revalidateNode);

      // Capture timestamp
      const timestamp = Date.now();

      // Get current mutation
      let currentMutation = getMutation<T>(key);

      // Hydrate mutation
      if (!currentMutation && initialData) {
        currentMutation = {
          result: {
            data: initialData,
            status: 'success',
          },
          timestamp,
        };
        setMutation(key, currentMutation);
      }

      // Opt-out of fetching process
      // if running on server
      if (!IS_CLIENT) {
        // If there is no mutation, resolve to pending
        if (!currentMutation) {
          return {
            status: 'pending',
            data: NEVER_PROMISE as Promise<T>,
          };
        }
        return {
          ...currentMutation.result,
        };
      }

      if (currentMutation) {
        if (!shouldRevalidate) {
          return {
            ...currentMutation.result,
          };
        }
        // If mutation is still fresh, return mutation
        if (currentMutation.timestamp + freshAge > timestamp) {
          return {
            ...currentMutation.result,
          };
        }
      }

      setRevalidation(key, false, false);

      // Perform fetch
      const pendingData = fullOptions.fetch(methods);

      let result: MutationResult<T>;

      if (pendingData instanceof Promise) {
        // Capture result
        result = {
          data: pendingData,
          status: 'pending',
        };

        // Watch for promise resolutions
        // to update cache data
        pendingData.then(
          (data) => {
            const current = getMutation(key)?.timestamp;
            if (current && current <= timestamp) {
              mutate(key, {
                data,
                status: 'success',
              });
            }
          },
          (data) => {
            const current = getMutation(key)?.timestamp;
            if (current && current <= timestamp) {
              mutate(key, {
                data,
                status: 'failure',
              });
            }
          },
        );

        // If there's an existing mutation
        // and mutation is stale
        // update timestamp and return
        if (
          currentMutation
          && currentMutation.timestamp + freshAge + staleAge > timestamp
        ) {
          // Updating this means that the freshness or the staleness
          // of a mutation resets
          currentMutation.timestamp = timestamp;
          return {
            ...currentMutation.result,
          };
        }
      } else {
        result = {
          data: pendingData,
          status: 'success',
        };
      }

      // Otherwise, set the new mutation
      setMutation(key, {
        result,
        timestamp,
      });

      return {
        ...result,
      };
    },
  });

  return {
    hydrate: (data) => hydrate(key, data),
    subscribe: (listener) => subscribe(key, listener),
    trigger: (shouldRevalidate = true) => trigger(key, shouldRevalidate),
    mutate: (data, shouldRevalidate = true) => mutate(key, data, shouldRevalidate),
    resource,
  };
}
