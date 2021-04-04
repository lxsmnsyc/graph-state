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
  GraphNodeDraftState,
  GraphNodeDraftStateAction,
  GraphNodeGet,
  GraphNodeGetSupplier,
  GraphNodeKey,
  GraphNodeSubscriptionCleanup,
} from './graph-node';
import { ensure } from './utils';

export type GraphNodeDependencies = Set<GraphNode<any, any>>;

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

  microtask: never[];
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

function isNodeValueFunc<S, A = GraphNodeDraftState<S>>(
  nodeValue: GraphNodeGet<S, A>,
): nodeValue is GraphNodeGetSupplier<S, A> {
  return typeof nodeValue === 'function';
}

function createGraphNodeGetterVersion(): GraphNodeVersion {
  return {
    alive: true,
    cleanups: [],
  };
}

function createGraphNodeSetterVersion(): GraphNodeVersion {
  return {
    alive: true,
    cleanups: [],
  };
}

function isDraftStateFunc<T>(
  action: GraphNodeDraftState<T>,
): action is GraphNodeDraftStateAction<T> {
  return typeof action === 'function';
}

function getDraftState<T>(action: GraphNodeDraftState<T>, oldState: T): T {
  if (isDraftStateFunc(action)) {
    return action(oldState);
  }
  return action;
}

function getGraphNodeInstance<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): GraphNodeInstance<S> {
  if (memory.nodes.has(node.key)) {
    return ensure(memory.nodes.get(node.key));
  }

  const dependencies: GraphNodeDependencies = new Set();
  const getterVersion = createGraphNodeGetterVersion();
  const baseNode: GraphNodeInstance<S> = {
    getterVersion,
    setterVersion: createGraphNodeSetterVersion(),
    listeners: new Set(),
    dependents: new Set(),
    dependencies,
    state: {
      version: 0,
      value: computeGraphNode(memory, node, getterVersion, dependencies),
    },
    microtask: [],
  };

  memory.nodes.set(node.key, baseNode);

  return baseNode;
}

function computeGraphNode<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  getterVersion: GraphNodeVersion,
  dependencies: GraphNodeDependencies,
): S {
  if (isNodeValueFunc(node.get)) {
    return node.get({
      get: (dependency) => {
        // Read dependency state
        const instance = getGraphNodeInstance(memory, dependency);
        // If the getterVersion is still alive, register dependency
        if (getterVersion.alive) {
          dependencies.add(dependency);
          instance.dependents.add(node);
        }
        return instance.state.value;
      },
      getSelf: () => getGraphNodeState(memory, node),
      mutate: (target, value) => {
        if (getterVersion.alive) {
          setGraphNodeState(memory, target, value);
        }
      },
      mutateSelf: (value) => {
        if (getterVersion.alive) {
          setGraphNodeState(memory, node, value);
        }
      },
      set: (target, action) => new Promise((resolve) => {
        if (getterVersion.alive) {
          resolve(runGraphNodeDispatch(memory, target, action));
        }
      }),
      setSelf: (action: A) => new Promise((resolve) => {
        if (getterVersion.alive) {
          resolve(runGraphNodeDispatch(memory, node, action));
        }
      }),
      reset: (target) => {
        if (getterVersion.alive) {
          runGraphNodeCompute(memory, target);
        }
      },
      resetSelf: () => {
        if (getterVersion.alive) {
          runGraphNodeCompute(memory, node);
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

function getGraphNodeStateRef<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): GraphNodeState<S> {
  const actualNode = getGraphNodeInstance(memory, node);
  return actualNode.state;
}

export function getGraphNodeState<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): S {
  return getGraphNodeStateRef(memory, node).value;
}

export function runGraphNodeDispatch<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  action: A,
): Promise<void> {
  if (node.set) {
    const actualNode = getGraphNodeInstance(memory, node);
    // Deprecate setter version
    actualNode.setterVersion.cleanups.forEach((cleanup) => {
      cleanup();
    });
    const setterVersion = createGraphNodeSetterVersion();
    actualNode.setterVersion.alive = false;
    actualNode.setterVersion = setterVersion;

    // Run the node setter for further effects
    return node.set({
      get: (target) => getGraphNodeState(memory, target),
      getSelf: () => getGraphNodeState(memory, node),
      set: (target, targetAction) => new Promise((resolve) => {
        if (setterVersion.alive) {
          resolve(runGraphNodeDispatch(memory, target, targetAction));
        }
      }),
      setSelf: (targetAction: A) => new Promise((resolve) => {
        if (setterVersion.alive) {
          resolve(runGraphNodeDispatch(memory, node, targetAction));
        }
      }),
      mutate: (target, targetValue) => {
        if (setterVersion.alive) {
          setGraphNodeState(memory, target, targetValue);
        }
      },
      mutateSelf: (targetValue) => {
        if (setterVersion.alive) {
          setGraphNodeState(memory, node, targetValue);
        }
      },
      reset: (target) => {
        if (setterVersion.alive) {
          runGraphNodeCompute(memory, target);
        }
      },
      resetSelf: () => {
        if (setterVersion.alive) {
          runGraphNodeCompute(memory, node);
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

  // Notify for new node value
  return new Promise((resolve) => {
    resolve(setGraphNodeState(
      memory,
      node,
      getDraftState(
        action as unknown as GraphNodeDraftState<S>,
        getGraphNodeState(memory, node),
      ),
    ));
  });
}

export function runGraphNodeCompute<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): void {
  const actualNode = getGraphNodeInstance(memory, node);
  /**
   * Clean the previous version to prevent
   * asynchronous dependency registration.
   */
  actualNode.dependencies.forEach((dependency) => {
    getGraphNodeInstance(memory, dependency).dependents.delete(node);
  });
  actualNode.getterVersion.cleanups.forEach((cleanup) => {
    cleanup();
  });
  actualNode.dependencies.clear();
  actualNode.getterVersion.alive = false;
  actualNode.getterVersion = createGraphNodeGetterVersion();
  /**
   * Set the new node value by recomputing the node.
   * This may recursively compute.
   */
  const newState = computeGraphNode(
    memory,
    node,
    actualNode.getterVersion,
    actualNode.dependencies,
  );

  setGraphNodeState(
    memory,
    node,
    newState,
  );
}

export function hydrateGraphNodeState<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  value: S,
): void {
  const actualNode = getGraphNodeInstance(memory, node);
  actualNode.state.value = value;
  actualNode.state.version += 1;
}

export function setGraphNodeState<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  value: S,
  notify = true,
): void {
  const actualNode = getGraphNodeInstance(memory, node);
  if (node.shouldUpdate(actualNode.state.value, value)) {
    const newTask: never[] = [];
    actualNode.microtask = newTask;
    memory.batcher(() => {
      if (actualNode.microtask === newTask) {
        actualNode.state.value = value;
        actualNode.state.version += 1;

        new Set(actualNode.dependents).forEach((dependent) => {
          runGraphNodeCompute(memory, dependent);
        });

        if (notify) {
          actualNode.listeners.forEach((listener) => {
            listener(value);
          });
        }

        exposeToWindow(memory);
      }
    });
  }
}

export function subscribeGraphNode<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  listener: GraphNodeListener<S>,
): () => void {
  const actualNode = getGraphNodeInstance(memory, node);
  actualNode.listeners.add(listener);

  return () => {
    actualNode.listeners.delete(listener);
  };
}

export function destroyGraphDomainMemory(
  memory: GraphDomainMemory,
): void {
  memory.nodes.forEach((node) => {
    node.getterVersion.cleanups.forEach((cleanup) => {
      cleanup();
    });
  });

  memory.nodes.clear();
}

export function hasGraphNode<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): boolean {
  return memory.nodes.has(node.key);
}

export function hasGraphNodeState<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): boolean {
  return hasGraphNode(memory, node);
}

export function getGraphNodeVersion<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): number {
  return getGraphNodeStateRef(memory, node).version;
}
