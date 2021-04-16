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
  GraphNode,
  GraphNodeAtomAction,
  GraphNodeAtomLazyAction,
  GraphNodeGet,
  GraphNodeKey,
  GraphNodeLazyGet,
  GraphNodeSubscriptionCleanup,
} from './graph-node';
import { ensure } from './utils';

export type GraphNodeDependencies = Set<GraphNode<any, any, any>>;

export interface GraphNodeVersion {
  alive: boolean;
  cleanups: GraphNodeSubscriptionCleanup[];
}

export type GraphNodeListener<T> = (value: T) => void;
export type GraphNodeListeners<T> = Set<GraphNodeListener<T>>;

export interface GraphNodeState<T> {
  version: number;
  value: T;
}
export interface GraphNodeInstance<T> {
  getterVersion: GraphNodeVersion;
  setterVersion: GraphNodeVersion;
  listeners: GraphNodeListeners<T>;
  state: GraphNodeState<T>;
  dependents: GraphNodeDependencies;
  dependencies: GraphNodeDependencies;
}

export type GraphNodeInstanceMap = Map<GraphNodeKey, GraphNodeInstance<any>>;

export type Batcher = (callback: () => void) => void;

export interface GraphDomainMemory {
  nodes: GraphNodeInstanceMap;
  batcher: Batcher;
}

function defaultBatcher(callback: () => void): void {
  callback();
}
export interface GraphNodeDebugData {
  id: GraphNodeKey;
  state?: any;
  dependents: GraphNodeKey[];
  dependencies: GraphNodeKey[];
}

interface WithGraphStateDomainMemory {
  withGraphStateDomainMemory: GraphNodeDebugData[];
}

declare const window: typeof globalThis & WithGraphStateDomainMemory;

function parseDependencies(
  dependencies: GraphNodeDependencies,
): GraphNodeKey[] {
  return Array.from(dependencies).map(
    (node) => node.key,
  );
}

function parseGraphDomainMemory(
  memory: GraphDomainMemory,
): GraphNodeDebugData[] {
  return Array.from(memory.nodes).map(([key, value]) => ({
    id: key,
    state: value.state.value,
    dependents: parseDependencies(value.dependents),
    dependencies: parseDependencies(value.dependencies),
  }));
}

function exposeToWindow(
  memory: GraphDomainMemory,
): void {
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    window.withGraphStateDomainMemory = parseGraphDomainMemory(memory);
  }
}

export function createGraphDomainMemory(
  batcher: Batcher = defaultBatcher,
): GraphDomainMemory {
  const memory = {
    nodes: new Map(),
    batcher,
  };

  exposeToWindow(memory);

  return memory;
}

function createVersion(): GraphNodeVersion {
  return {
    alive: true,
    cleanups: [],
  };
}

function getInstance<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): GraphNodeInstance<S> {
  if (memory.nodes.has(node.key)) {
    return ensure(memory.nodes.get(node.key));
  }

  const dependencies: GraphNodeDependencies = new Set();
  const getterVersion = createVersion();
  const baseNode: GraphNodeInstance<S> = {
    getterVersion,
    setterVersion: createVersion(),
    listeners: new Set(),
    dependents: new Set(),
    dependencies,
    state: {
      version: 0,
      value: createState(memory, node, getterVersion, dependencies),
    },
  };

  memory.nodes.set(node.key, baseNode);

  return baseNode;
}

function isNodeGetFunction<S, A, R>(
  value: GraphNodeGet<S, A, R>,
): value is GraphNodeLazyGet<S, A, R> {
  return typeof value === 'function';
}

function createState<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  getterVersion: GraphNodeVersion,
  dependencies: GraphNodeDependencies,
): S {
  if (isNodeGetFunction(node.get)) {
    return node.get({
      get: (dependency) => {
        // Read dependency state
        const instance = getInstance(memory, dependency);
        // If the getterVersion is still alive, register dependency
        if (getterVersion.alive) {
          dependencies.add(dependency);
          instance.dependents.add(node);
        }
        return instance.state.value;
      },
      getSelf: () => get(memory, node),
      mutate: (target, value) => {
        if (getterVersion.alive) {
          set(memory, target, value);
        }
      },
      mutateSelf: (value) => {
        if (getterVersion.alive) {
          set(memory, node, value);
        }
      },
      set: (target, action) => dispatch(memory, target, action),
      setSelf: (action: A) => dispatch(memory, node, action),
      reset: (target) => {
        if (getterVersion.alive) {
          reset(memory, target);
        }
      },
      resetSelf: () => {
        if (getterVersion.alive) {
          reset(memory, node);
        }
      },
      subscription: (callback) => {
        if (getterVersion.alive) {
          const cleanup = callback();

          if (cleanup) {
            getterVersion.cleanups.push(cleanup);
          }
        }
      },
      resolve: (promise) => new Promise((resolve, reject) => {
        promise.then(
          (result) => {
            if (getterVersion.alive) {
              resolve(result);
            }
          },
          (result) => {
            if (getterVersion.alive) {
              reject(result);
            }
          },
        );
      }),
    });
  }
  return node.get;
}

function getRef<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): GraphNodeState<S> {
  const actualNode = getInstance(memory, node);
  return actualNode.state;
}

export function get<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): S {
  return getRef(memory, node).value;
}
/**
 * @deprecated
 */
export function getGraphNodeState<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): S {
  return get(memory, node);
}

export function dispatch<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  action: A,
): R {
  const actualNode = getInstance(memory, node);
  // Deprecate setter version
  actualNode.setterVersion.cleanups.forEach((cleanup) => {
    cleanup();
  });
  const setterVersion = createVersion();
  actualNode.setterVersion.alive = false;
  actualNode.setterVersion = setterVersion;

  // Run the node setter for further effects
  return node.set({
    get: (target) => get(memory, target),
    getSelf: () => get(memory, node),
    set: (target, targetAction) => dispatch(memory, target, targetAction),
    setSelf: (targetAction: A) => dispatch(memory, node, targetAction),
    mutate: (target, targetValue) => {
      if (setterVersion.alive) {
        set(memory, target, targetValue);
      }
    },
    mutateSelf: (targetValue) => {
      if (setterVersion.alive) {
        set(memory, node, targetValue);
      }
    },
    reset: (target) => {
      if (setterVersion.alive) {
        reset(memory, target);
      }
    },
    resetSelf: () => {
      if (setterVersion.alive) {
        reset(memory, node);
      }
    },
    resolve: (promise) => new Promise((resolve, reject) => {
      promise.then(
        (result) => {
          if (setterVersion.alive) {
            resolve(result);
          }
        },
        (result) => {
          if (setterVersion.alive) {
            reject(result);
          }
        },
      );
    }),
    subscription: (callback) => {
      if (setterVersion.alive) {
        const cleanup = callback();

        if (cleanup) {
          setterVersion.cleanups.push(cleanup);
        }
      }
    },
  }, action);
}
/**
 * @deprecated
 */
export function runGraphNodeDispatch<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  action: A,
): R {
  return dispatch(memory, node, action);
}

export function reset<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): void {
  const actualNode = getInstance(memory, node);
  /**
   * Clean the previous version to prevent
   * asynchronous dependency registration.
   */
  actualNode.dependencies.forEach((dependency) => {
    getInstance(memory, dependency).dependents.delete(node);
  });
  actualNode.getterVersion.cleanups.forEach((cleanup) => {
    cleanup();
  });
  actualNode.dependencies.clear();
  actualNode.getterVersion.alive = false;
  actualNode.getterVersion = createVersion();
  /**
   * Set the new node value by recomputing the node.
   * This may recursively compute.
   */
  const newState = createState(
    memory,
    node,
    actualNode.getterVersion,
    actualNode.dependencies,
  );

  set(
    memory,
    node,
    newState,
  );
}
/**
 * @deprecated
 */
export function runGraphNodeCompute<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): void {
  reset(memory, node);
}

export function hydrate<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  value: S,
): void {
  const actualNode = getInstance(memory, node);
  actualNode.state.value = value;
  actualNode.state.version += 1;
}
/**
 * @deprecated
 */
export function hydrateGraphNodeState<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  value: S,
): void {
  hydrate(memory, node, value);
}

function isActionFunction<S>(
  value: GraphNodeAtomAction<S>,
): value is GraphNodeAtomLazyAction<S> {
  return typeof value === 'function';
}

export function set<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  value: GraphNodeAtomAction<S>,
  notify = true,
): void {
  const actualNode = getInstance(memory, node);
  const newState = isActionFunction(value)
    ? value(actualNode.state.value)
    : value;
  if (node.shouldUpdate(actualNode.state.value, newState)) {
    memory.batcher(() => {
      actualNode.state.value = newState;
      actualNode.state.version += 1;

      new Set(actualNode.dependents).forEach((dependent) => {
        reset(memory, dependent);
      });

      if (notify) {
        actualNode.listeners.forEach((listener) => {
          listener(newState);
        });
      }

      exposeToWindow(memory);
    });
  }
}
/**
 * @deprecated
 */
export function setGraphNodeState<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  value: GraphNodeAtomAction<S>,
  notify = true,
): void {
  set(memory, node, value, notify);
}

export function subscribe<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  listener: GraphNodeListener<S>,
): () => void {
  const actualNode = getInstance(memory, node);
  actualNode.listeners.add(listener);

  return () => {
    actualNode.listeners.delete(listener);
  };
}
/**
 * @deprecated
 */
export function subscribeGraphNode<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
  listener: GraphNodeListener<S>,
): () => void {
  return subscribe(memory, node, listener);
}

export function destroyMemory(
  memory: GraphDomainMemory,
): void {
  memory.nodes.forEach((node) => {
    node.getterVersion.cleanups.forEach((cleanup) => {
      cleanup();
    });
  });

  memory.nodes.clear();
}
/**
 * @deprecated
 */
export function destroyGraphDomainMemory(
  memory: GraphDomainMemory,
): void {
  destroyMemory(memory);
}

export function exists<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): boolean {
  return memory.nodes.has(node.key);
}
/**
 * @deprecated
 */
export function hasGraphNode<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): boolean {
  return exists(memory, node);
}

export function version<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): number {
  return getRef(memory, node).version;
}
/**
 * @deprecated
 */
export function getGraphNodeVersion<S, A, R>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A, R>,
): number {
  return version(memory, node);
}
