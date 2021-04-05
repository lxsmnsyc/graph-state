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
  useDebugValue,
  useEffect,
  useRef,
} from 'react';
import {
  createGraphDomainMemory,
  destroyGraphDomainMemory,
  GraphDomainMemory,
  GraphNode,
  getGraphNodeState,
  subscribeGraphNode,
} from 'graph-state';
import {
  useConstant,
} from '@lyonph/react-hooks';
import {
  createNullaryModel,
  createValue,
  useScopedModelExists,
} from 'react-scoped-model';
import { createStoreAdapter, StoreAdapter } from 'react-store-adapter';
import OutOfGraphDomainError from './utils/OutOfGraphDomainError';

export interface GraphDomainCoreContext {
  memory: GraphDomainMemory;
  get: <S, A>(node: GraphNode<S, A>) => StoreAdapter<S>;
}

const GraphDomainCore = createNullaryModel(() => {
  const isMounted = useRef(true);

  const memory = useConstant<GraphDomainMemory>(
    () => createGraphDomainMemory(),
  );
  const stores = useConstant(() => (
    new Map<string | number, StoreAdapter<any>>()
  ));

  useDebugValue(memory.nodes);

  useEffect(() => () => {
    isMounted.current = false;
    destroyGraphDomainMemory(memory);
  }, [memory]);

  return useConstant<GraphDomainCoreContext>(() => ({
    memory,
    get: <S, A>(node: GraphNode<S, A>): StoreAdapter<S> => {
      const store = stores.get(node.key);

      if (store) {
        return store;
      }

      const newStore = createStoreAdapter({
        read: () => getGraphNodeState(memory, node),
        subscribe: (callback) => subscribeGraphNode(memory, node, callback),
      });
      stores.set(node.key, newStore);
      return newStore;
    },
  }));
}, {
  displayName: 'GraphDomainCore',
});

export const useGraphDomainCore = createValue(GraphDomainCore);

export function useGraphDomainRestriction(): void {
  const context = useScopedModelExists(GraphDomainCore);

  if (!context) {
    throw new OutOfGraphDomainError();
  }
}

export default GraphDomainCore;
