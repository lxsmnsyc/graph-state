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
import { get, GraphNodeResource } from 'graph-state';
import { useDebugValue } from 'preact/hooks';
import { useGraphDomainCore, useGraphDomainRestriction } from '../GraphDomainCore';
import createResolvable from '../utils/resolvable';
import useGraphNodeValueBase from './useGraphNodeValueBase';

export default function useGraphNodeResource<S>(node: GraphNodeResource<S>): S {
  useGraphDomainRestriction();
  const context = useGraphDomainCore();

  const value = useGraphNodeValueBase(context, node);

  useDebugValue(value.status === 'success' ? value.data : value);

  if (value.status === 'success') {
    return value.data;
  }

  // The following implementation is a HACK.

  // Preact's Suspense resolution timing is different from React
  // In here, we create a chain of promises that resolves the previous
  // one to throttle the resolution. Until such a time that the
  // resolution matches the unsafe state, it will defer the resolution
  // timing.
  if (value.status === 'pending') {
    const current = context.cache.get(node.key);

    if (current) {
      if (current.status === 'success') {
        context.cache.delete(node.key);
        return current.data;
      }
      if (current.status === 'failure') {
        context.cache.delete(node.key);
        throw current.data;
      }
      if (current.status === 'pending' && current.promise === value.data) {
        throw current.data.promise;
      }
    }

    const resolvable = createResolvable();

    if (current) {
      resolvable.promise.then(() => {
        current.data.resolve();
      }, () => {
        current.data.resolve();
      });
    }

    const stage = (promise: Promise<any>): void => {
      promise.then(
        () => {
          const cache = context.cache.get(node.key);
          if (cache?.data === resolvable) {
            const state = get(context.memory, node);

            if (state.status === 'success' || state.status === 'failure') {
              context.cache.set(node.key, state);
              resolvable.resolve();
            } else {
              stage(state.data);
            }
          }
        },
        () => {
          const cache = context.cache.get(node.key);
          if (cache?.data === resolvable) {
            const state = get(context.memory, node);

            if (state.status === 'success' || state.status === 'failure') {
              context.cache.set(node.key, state);
              resolvable.resolve();
            } else {
              stage(state.data);
            }
          }
        },
      );
    };

    stage(value.data);

    context.cache.set(node.key, {
      status: 'pending',
      data: resolvable,
      promise: value.data,
    });

    throw resolvable.promise;
  }

  throw value.data;
}
