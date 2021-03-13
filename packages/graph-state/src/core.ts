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
  GraphNodeGetInterface,
  GraphNodeGetSupplier,
  GraphNodeKey,
  GraphNodeSubscriptionCleanup,
} from './graph-node';

export type GraphNodeDependencies = Set<GraphNode<any, any>>;

export interface GraphNodeBaseVersion {
  alive: boolean;
}

export interface GraphNodeVersion extends GraphNodeBaseVersion {
  // Dependencies
  dependencies: GraphNodeDependencies;
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
  setterVersion: GraphNodeBaseVersion;
  listeners: GraphNodeListeners<T>;
  state: GraphNodeState<T>;
  dependents: GraphNodeDependencies;
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
    dependencies: parseDependencies(value.getterVersion.dependencies),
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

// This function ensures Map.prototype.get's compile-time
// type inference isn't nullish.
function ensure<T>(value: T | undefined): T {
  if (value == null) {
    throw new Error('Unable to return a nullish value.');
  }
  return value;
}

function isNodeValueFunc<S, A = GraphNodeDraftState<S>>(
  nodeValue: GraphNodeGet<S, A>,
): nodeValue is GraphNodeGetSupplier<S, A> {
  return typeof nodeValue === 'function';
}

function createNodeValue<S, A = GraphNodeDraftState<S>>(
  node: GraphNode<S, A>,
  methods: GraphNodeGetInterface<S, A>,
): S {
  return isNodeValueFunc(node.get)
    ? node.get(methods)
    : node.get;
}

function createGraphNodeGetterVersion(): GraphNodeVersion {
  return {
    alive: true,
    dependencies: new Set(),
    cleanups: [],
  };
}

function createGraphNodeSetterVersion(): GraphNodeBaseVersion {
  return {
    alive: true,
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

  const getterVersion = createGraphNodeGetterVersion();
  const baseNode: GraphNodeInstance<S> = {
    getterVersion,
    setterVersion: createGraphNodeSetterVersion(),
    listeners: new Set(),
    dependents: new Set(),
    state: {
      version: 0,
      value: computeGraphNode(memory, node, getterVersion),
    },
  };

  memory.nodes.set(node.key, baseNode);

  return baseNode;
}

function unregisterGraphNodeDependency<S, A, R, T>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  dependency: GraphNode<R, T>,
  getterVersion = getGraphNodeInstance(memory, node).getterVersion,
): void {
  getterVersion.dependencies.delete(dependency);

  getGraphNodeInstance(memory, dependency).dependents.delete(node);
}

function deprecateNodeGetterVersion<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  actualNode = getGraphNodeInstance(memory, node),
): void {
  actualNode.getterVersion.dependencies.forEach((dependency) => {
    unregisterGraphNodeDependency(memory, dependency, node);
  });
  actualNode.getterVersion.cleanups.forEach((cleanup) => {
    cleanup();
  });
  actualNode.getterVersion.alive = false;
  actualNode.getterVersion = createGraphNodeGetterVersion();
}

function deprecateGraphNodeSetterVersion<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  actualNode = getGraphNodeInstance(memory, node),
): void {
  actualNode.setterVersion.alive = false;
  actualNode.setterVersion = createGraphNodeSetterVersion();
}

function computeGraphNode<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  getterVersion = getGraphNodeInstance(memory, node).getterVersion,
): S {
  return createNodeValue<S, A>(
    node,
    {
      get: (dependency) => {
        // Read dependency state
        const currentState = getGraphNodeState(memory, dependency);
        // If the getterVersion is still alive, register dependency
        if (getterVersion.alive) {
          getterVersion.dependencies.add(dependency);

          getGraphNodeInstance(memory, dependency).dependents.add(node);
        }
        return currentState;
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
      setSelf: (action: A) => {
        if (getterVersion.alive) {
          runGraphNodeDispatch(memory, node, action);
        }
      },
      set: (target, action) => {
        if (getterVersion.alive) {
          runGraphNodeDispatch(memory, target, action);
        }
      },
      reset: (target) => {
        if (getterVersion.alive) {
          runGraphNodeCompute(memory, target);
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
    },
  );
}

function getGraphNodeStateRef<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  actualNode = getGraphNodeInstance(memory, node),
): GraphNodeState<S> {
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
  actualNode = getGraphNodeInstance(memory, node),
): void {
  // Get instance node
  const currentState = getGraphNodeState(memory, node);

  if (node.set) {
    // Deprecate setter version
    deprecateGraphNodeSetterVersion(memory, node, actualNode);

    const { setterVersion } = actualNode;
    // Run the node setter for further effects
    node.set({
      get: (target) => getGraphNodeState(memory, target),
      getSelf: () => getGraphNodeState(memory, node),
      set: (target, targetAction) => {
        if (setterVersion.alive) {
          runGraphNodeDispatch(memory, target, targetAction);
        }
      },
      setSelf: (targetAction) => {
        if (setterVersion.alive) {
          runGraphNodeDispatch(memory, node, targetAction, actualNode);
        }
      },
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
    }, action);
  } else {
    // Notify for new node value
    setGraphNodeState(
      memory,
      node,
      getDraftState(
        action as unknown as GraphNodeDraftState<S>,
        currentState,
      ),
    );
  }
}

export function runGraphNodeCompute<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  actualNode = getGraphNodeInstance(memory, node),
): void {
  /**
   * Clean the previous version to prevent
   * asynchronous dependency registration.
   */
  deprecateNodeGetterVersion(memory, node, actualNode);
  /**
   * Set the new node value by recomputing the node.
   * This may recursively compute.
   */
  setGraphNodeState(
    memory,
    node,
    computeGraphNode(memory, node, actualNode.getterVersion),
  );
}

export function runGraphNodeUpdate<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  notify = true,
  actualNode = getGraphNodeInstance(memory, node),
): void {
  memory.batcher(() => {
    actualNode.dependents.forEach((dependent) => {
      runGraphNodeCompute(memory, dependent);
    });

    const state = actualNode.state.value;

    if (notify) {
      actualNode.listeners.forEach((listener) => {
        listener(state);
      });
    }

    exposeToWindow(memory);
  });
}

export function setGraphNodeState<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  value: S,
  notify = true,
  actualNode = getGraphNodeInstance(memory, node),
): void {
  if (node.shouldUpdate(actualNode.state.value, value)) {
    actualNode.state.value = value;
    actualNode.state.version += 1;

    runGraphNodeUpdate(memory, node, notify);
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
