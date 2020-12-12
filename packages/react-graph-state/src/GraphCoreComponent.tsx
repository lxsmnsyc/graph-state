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
import { useDisposableMemo } from 'use-dispose';
import { GraphCore } from 'graph-state';
import { useGraphCoreContext } from './GraphCoreContext';
import useConstantCallback from './hooks/useConstantCallback';

function useGraphCoreProcess() {
  const { current } = useGraphCoreContext();

  const core = useDisposableMemo<GraphCore>(
    () => new GraphCore(),
    // Component renders twice before side-effects and commits run.
    // Dispose the current memory to prevent leaks to external sources.
    (instance) => instance.destroy(),
  );

  const [state, setState] = useState<(() => void)[]>([]);

  const batch = useConstantCallback((cb: () => void) => {
    setState((prev) => [...prev, cb]);
  });

  current.value = {
    instance: core,
    batch,
  };

  useEffect(() => {
    if (state.length > 0) {
      setState([]);

      state.forEach((batched) => {
        batched();
      });
    }
  }, [state]);

  useDebugValue(core.memory.state);
}

function GraphCoreProcess(): null {
  useGraphCoreProcess();
  return null;
}

const GraphCoreComponent = memo(GraphCoreProcess, () => true);

export default GraphCoreComponent;
