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
import { GraphNode } from 'graph-state';
import { useDebugValue } from 'react';
import { useGraphDomainCore, useGraphDomainRestriction } from '../GraphDomainCore';
import useGraphNodeDispatchBase, { GraphNodeDispatch } from './useGraphNodeDispatchBase';
import useGraphNodeResetBase, { GraphNodeReset } from './useGraphNodeResetBase';
import useGraphNodeValueBase from './useGraphNodeValueBase';

export default function useGraphNodeState<S, A, R>(
  node: GraphNode<S, A, R>,
): [S, GraphNodeDispatch<A, R>, GraphNodeReset] {
  useGraphDomainRestriction();
  const context = useGraphDomainCore();
  const state = useGraphNodeValueBase(context, node);
  const dispatch = useGraphNodeDispatchBase(context, node);
  const reset = useGraphNodeResetBase(context, node);

  useDebugValue([state, dispatch, reset]);

  return [state, dispatch, reset];
}
