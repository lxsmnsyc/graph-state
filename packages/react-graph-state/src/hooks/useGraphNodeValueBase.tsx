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
// import { GraphCore, GraphNode } from 'graph-state';
// import useSubscription, { Subscription } from './useSubscription';
// import useMemoCondition from './useMemoCondition';
// import { compareArray } from '../utils/compareTuple';
import { GraphCore, GraphNode } from 'graph-state';
import { useEffect } from 'react';
import { compareArray } from '../utils/compareTuple';
import useCallbackCondition from './useCallbackCondition';
import useFreshLazyRef, { defaultCompare } from './useFreshLazyRef';
import useSubscription from './useSubscription';

// export default function useGraphNodeValueBase<S, A>(
//   core: GraphCore,
//   node: GraphNode<S, A>,
// ): S {
//   const sub = useMemoCondition(
//     (): Subscription<S> => ({
//       read: () => core.getNodeState(node),
//       subscribe: (handler) => core.subscribe(node, handler),
//     }),
//     [core, node],
//     compareArray,
//   );
//   return useSubscription(sub);
// }
export default function useGraphNodeValueBase<S, A>(
  core: GraphCore,
  node: GraphNode<S, A>,
): S {
  const lastVersion = useFreshLazyRef(
    () => ({
      value: core.getNodeState(node),
      version: 0,
    }),
    [core, node],
    compareArray,
  );

  if (defaultCompare(lastVersion.current.value, core.getNodeState(node))) {
    lastVersion.current.version += 1;
  }

  const read = useCallbackCondition(
    () => core.getNodeState(node),
    [core, node, lastVersion.current.version],
    compareArray,
  );
  const subscribe = useCallbackCondition(
    (handler: () => void) => core.subscribe(node, () => {
      lastVersion.current.value = core.getNodeState(node);
      handler();
    }),
    [core, node],
    compareArray,
  );

  useEffect(() => {
    lastVersion.current.value = core.getNodeState(node);
  });

  return useSubscription({ read, subscribe });
}
