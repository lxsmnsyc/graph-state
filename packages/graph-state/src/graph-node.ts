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
  defaultSerialize,
  defaultShouldUpdate,
  ensure,
  generateKey,
} from './utils';

export type GraphNodeKey = string | number;

export type GraphNodeShouldUpdate<S> = (prev: S, next: S) => boolean;

export type GraphNodeAtomLazyAction<S> = (prev: S) => S;
export type GraphNodeAtomAction<S> = S | GraphNodeAtomLazyAction<S>;

export type GraphNodeSubscriptionCleanup = () => void;
export type GraphNodeSubscriptionCallback = () => void | undefined | GraphNodeSubscriptionCleanup;
export type GraphNodeSubscription = (callback: GraphNodeSubscriptionCallback) => void;

export type GraphNodeResolve = <T>(promise: Promise<T>) => Promise<T>;

export interface GraphNodeContext<S, A, R> {
  get<S1, A1, R1>(node: GraphNode<S1, A1, R1>): S1;

  set<S1, A1, R1>(node: GraphNode<S1, A1, R1>, action: A1): R1;

  reset<S1, A1, R1>(node: GraphNode<S1, A1, R1>): void;

  mutate<S1, A1, R1>(node: GraphNode<S1, A1, R1>, value: GraphNodeAtomAction<S1>): void;

  subscription: GraphNodeSubscription;

  resolve: GraphNodeResolve;

  setSelf(action: A): R;
  getSelf(): S;
  resetSelf(): void;
  mutateSelf(value: GraphNodeAtomAction<S>): void;
}

export type GraphNodeLazyGet<S, A, R> = (context: GraphNodeContext<S, A, R>) => S;
export type GraphNodeGet<S, A, R> = S | GraphNodeLazyGet<S, A, R>;
export type GraphNodeSet<S, A, R> = (context: GraphNodeContext<S, A, R>, action: A) => R;

export interface GraphNode<S, A, R> {
  key: GraphNodeKey;
  shouldUpdate: GraphNodeShouldUpdate<S>;
  get: GraphNodeGet<S, A, R>;
  set: GraphNodeSet<S, A, R>;
}

export type GraphNodeAtom<S> = GraphNode<S, GraphNodeAtomAction<S>, void>;

const NODES = new Map<GraphNodeKey, GraphNode<any, any, any>>();
const KEYS = new Map<GraphNodeKey, GraphNodeKey>();

function createKey(key?: GraphNodeKey): GraphNodeKey {
  // Check if there's a key
  if (key) {
    if (process.env.NODE_ENV === 'production') {
      // If the key already exists, return the
      // memoized key
      if (KEYS.has(key)) {
        return ensure(KEYS.get(key));
      }
      const newKey = generateKey();
      KEYS.set(key, newKey);
      return newKey;
    }
    return key;
  }

  return generateKey();
}

export interface GraphNodeAtomOptions<S> {
  key?: GraphNodeKey;
  shouldUpdate?: GraphNodeShouldUpdate<S>;
  get: GraphNodeGet<S, GraphNodeAtomAction<S>, void>;
}

export interface GraphNodeOptions<S, A, R> {
  key?: GraphNodeKey;
  shouldUpdate?: GraphNodeShouldUpdate<S>;
  get: GraphNodeGet<S, A, R>;
  set: GraphNodeSet<S, A, R>;
}

function createRawGraphNode<S>(
  options: GraphNodeAtomOptions<S>,
): GraphNodeAtom<S>;
function createRawGraphNode<S, A, R>(
  options: GraphNodeOptions<S, A, R>,
): GraphNode<S, A, R>;
function createRawGraphNode<S, A, R>(
  options: GraphNodeAtomOptions<S> | GraphNodeOptions<S, A, R>,
): GraphNodeAtom<S> | GraphNode<S, A, R> {
  const key = createKey(options.key);
  const shouldUpdate = options.shouldUpdate ?? defaultShouldUpdate;

  if ('set' in options) {
    return {
      get: options.get,
      set: options.set,
      key,
      shouldUpdate,
    };
  }

  const newNode: GraphNodeAtom<S> = {
    get: options.get,
    set: (context, action) => {
      context.mutateSelf(action);
    },
    key,
    shouldUpdate,
  };

  return newNode;
}

/**
* Creates a graph-state node instance.
*/
export function node<S>(
  options: GraphNodeAtomOptions<S>
): GraphNodeAtom<S>;
/**
* Creates a graph-state node instance with a
* custom dispatch behavior.
*/
export function node<S, A, R>(
  options: GraphNodeOptions<S, A, R>
): GraphNode<S, A, R>;
export function node<S, A, R>(
  options: GraphNodeAtomOptions<S> | GraphNodeOptions<S, A, R>,
): GraphNodeAtom<S> | GraphNode<S, A, R> {
  if (options.key != null) {
    const currentNode = NODES.get(createKey(options.key));
    if (currentNode) {
      return currentNode;
    }
  }
  const newNode = 'set' in options
    ? createRawGraphNode(options)
    : createRawGraphNode(options);
  NODES.set(newNode.key, newNode);
  return newNode;
}

/**
* Creates a graph-state node instance.
* @deprecated Please use `node`
*/
export function createGraphNode<S>(
  options: GraphNodeAtomOptions<S>
): GraphNodeAtom<S>;
/**
* Creates a graph-state node instance with a
* custom dispatch behavior.
* @deprecated Please use `node`
*/
export function createGraphNode<S, A, R>(
  options: GraphNodeOptions<S, A, R>
): GraphNode<S, A, R>;
export function createGraphNode<S, A, R>(
  options: GraphNodeAtomOptions<S> | GraphNodeOptions<S, A, R>,
): GraphNodeAtom<S> | GraphNode<S, A, R> {
  return 'set' in options
    ? node(options)
    : node(options);
}

export interface GraphNodeFactoryBaseOptions<S, P extends any[] = []> {
  factoryKey: string;
  key: (...args: P) => GraphNodeKey;
  shouldUpdate: (...args: P) => GraphNodeShouldUpdate<S>;
}

export type GraphNodeBaseFactory<S, P extends any[] = []> =
  (...args: P) => GraphNodeAtom<S>;
export type GraphNodeAtomFactory<S, P extends any[] = []> =
  (...args: P) => GraphNodeAtom<S>;
export type GraphNodeFactory<S, A, R, P extends any[] = []> =
  (...args: P) => GraphNode<S, A, R>;

export interface GraphNodeAtomFactoryOptions<S, P extends any[] = []>
  extends GraphNodeFactoryBaseOptions<S, P> {
  get: (...args: P) => GraphNodeGet<S, GraphNodeAtomAction<S>, void>;
}
export interface GraphNodeFactoryOptions<S, A, R, P extends any[] = []>
  extends GraphNodeFactoryBaseOptions<S, P> {
  get: (...args: P) => GraphNodeGet<S, A, R>;
  set: (...args: P) => GraphNodeSet<S, A, R>;
}

export function factory<S, P extends any[] = []>(
  options: GraphNodeAtomFactoryOptions<S, P>
): GraphNodeAtomFactory<S, P>;
export function factory<S, A, R, P extends any[] = []>(
  options: GraphNodeFactoryOptions<S, A, R, P>
): GraphNodeFactory<S, A, R, P>;
export function factory<S, A, R, P extends any[] = []>(
  options: (
    | GraphNodeAtomFactoryOptions<S, P>
    | GraphNodeFactoryOptions<S, A, R, P>
  ),
): GraphNodeAtomFactory<S, P> | GraphNodeFactory<S, A, R, P> {
  const factoryKey = `Factory[${options.factoryKey ?? generateKey()}]`;

  if ('set' in options) {
    return (...args: P) => node({
      key: `${factoryKey}(${options.key ? options.key(...args) : defaultSerialize(args)}`,
      get: options.get(...args),
      set: options.set(...args),
      shouldUpdate: options.shouldUpdate ? options.shouldUpdate(...args) : undefined,
    });
  }

  return (...args: P) => node({
    key: `${factoryKey}(${options.key ? options.key(...args) : defaultSerialize(args)}`,
    get: options.get(...args),
    shouldUpdate: options.shouldUpdate ? options.shouldUpdate(...args) : undefined,
  });
}

/**
* @deprecated Please use `factory`
*/
export function createGraphNodeFactory<S, P extends any[] = []>(
  options: GraphNodeAtomFactoryOptions<S, P>
): GraphNodeAtomFactory<S, P>;
/**
* @deprecated Please use `factory`
*/
export function createGraphNodeFactory<S, A, R, P extends any[] = []>(
  options: GraphNodeFactoryOptions<S, A, R, P>
): GraphNodeFactory<S, A, R, P>;
export function createGraphNodeFactory<S, A, R, P extends any[] = []>(
  options: (
    | GraphNodeAtomFactoryOptions<S, P>
    | GraphNodeFactoryOptions<S, A, R, P>
  ),
): GraphNodeAtomFactory<S, P> | GraphNodeFactory<S, A, R, P> {
  return 'set' in options
    ? factory(options)
    : factory(options);
}
