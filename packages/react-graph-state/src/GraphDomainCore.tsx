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
  memo,
  useDebugValue,
  useEffect,
  useState,
} from 'react';
import {
  createGraphDomainMemory,
  destroyGraphDomainMemory,
  GraphDomainMemory,
  Batcher,
} from 'graph-state';
import { useDisposableMemo } from 'use-dispose';
import {
  useConstantCallback,
  useMountedState,
} from '@lyonph/react-hooks';
import { useGraphDomainContext } from './GraphDomainContext';

function useGraphDomainCore() {
  const { current } = useGraphDomainContext();

  const [batcher, setBatcher] = useState<(() => void)[]>([]);

  const isMounted = useMountedState();

  const batchUpdate = useConstantCallback<Batcher>((callback) => {
    if (isMounted()) {
      setBatcher((cbs) => [
        ...cbs,
        callback,
      ]);
    }
  });

  const memory = useDisposableMemo<GraphDomainMemory>(
    () => createGraphDomainMemory(batchUpdate),
    // Component renders twice before side-effects and commits run.
    // Dispose the current memory to prevent leaks to external sources.
    (instance) => destroyGraphDomainMemory(instance),
  );

  useEffect(() => {
    if (batcher.length > 0) {
      setBatcher([]);

      let mounted = true;
      batcher.forEach((batchedUpdate) => {
        if (mounted) {
          batchedUpdate();
        }
      });

      return () => {
        mounted = false;
      };
    }

    return undefined;
  }, [batcher]);

  current.value = memory;

  useDebugValue(memory.nodes);
}

const GraphDomainCore = memo(() => {
  useGraphDomainCore();
  return null;
}, () => true);

export default GraphDomainCore;
