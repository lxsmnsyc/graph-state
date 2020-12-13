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

export interface GraphNodeInstance<T> {
  getterVersion: GraphNodeVersion;
  setterVersion: GraphNodeBaseVersion;
  listeners: GraphNodeListeners<T>;
  dependents: GraphNodeDependencies;
}

export interface GraphNodeState<T> {
  version: number;
  value: T;
}
export type GraphNodeInstanceMap = Map<GraphNodeKey, GraphNodeInstance<any>>;
export type GraphNodeStateMap = Map<GraphNodeKey, GraphNodeState<any>>;

export interface GraphDomainMemory {
  nodes: GraphNodeInstanceMap;
  state: GraphNodeStateMap;
}

function createGraphDomainMemory(): GraphDomainMemory {
  return {
    nodes: new Map(),
    state: new Map(),
  };
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

function createNodeGetterVersion(): GraphNodeVersion {
  return {
    alive: true,
    dependencies: new Set(),
    cleanups: [],
  };
}

function createNodeSetterVersion(): GraphNodeBaseVersion {
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
    state: memory.state.get(key)?.value,
    dependents: parseDependencies(value.dependents),
    dependencies: parseDependencies(value.getterVersion.dependencies),
  }));
}

function exposeToWindow(
  memory: GraphDomainMemory,
): void {
  if (typeof window !== 'undefined') {
    window.withGraphStateDomainMemory = parseGraphDomainMemory(memory);
  }
}

function getNodeInstance<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
): GraphNodeInstance<S> {
  const currentNode = memory.nodes.get(node.key);

  if (!currentNode) {
    const baseNode: GraphNodeInstance<S> = {
      getterVersion: createNodeGetterVersion(),
      setterVersion: createNodeSetterVersion(),
      listeners: new Set(),
      dependents: new Set(),
    };

    memory.nodes.set(node.key, baseNode);

    return baseNode;
  }

  return currentNode;
}

function registerNodeDependency<S, A, R, T>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  dependency: GraphNode<R, T>,
  actualNode = getNodeInstance(memory, node),
): void {
  actualNode.getterVersion.dependencies.add(dependency);

  getNodeInstance(memory, dependency).dependents.add(node);
}

function unregisterNodeDependency<S, A, R, T>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  dependency: GraphNode<R, T>,
  actualNode = getNodeInstance(memory, node),
): void {
  actualNode.getterVersion.dependencies.delete(dependency);

  getNodeInstance(memory, dependency).dependents.delete(node);
}

function deprecateNodeGetterVersion<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  actualNode = getNodeInstance(memory, node),
): void {
  actualNode.getterVersion.dependencies.forEach((dependency) => {
    unregisterNodeDependency(memory, dependency, node);
  });
  actualNode.getterVersion.cleanups.forEach((cleanup) => {
    cleanup();
  });
  actualNode.getterVersion.alive = false;
  actualNode.getterVersion = createNodeGetterVersion();
}

function deprecateNodeSetterVersion<S, A = GraphNodeDraftState<S>>(
  memory: GraphDomainMemory,
  node: GraphNode<S, A>,
  actualNode = getNodeInstance(memory, node),
): void {
  actualNode.setterVersion.alive = false;
  actualNode.setterVersion = createNodeSetterVersion();
}

export default class GraphCore {
  public memory: GraphDomainMemory;

  constructor() {
    this.memory = createGraphDomainMemory();
  }

  getNodeStateRef<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): GraphNodeState<S> {
    const currentState = this.memory.state.get(node.key);

    if (currentState) {
      return currentState;
    }

    const newState = {
      version: 0,
      value: this.computeNode(node),
    };

    this.memory.state.set(node.key, newState);

    return newState;
  }

  getNodeState<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): S {
    return this.getNodeStateRef(node).value;
  }

  setNodeState<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    value: S,
    notify = true,
  ): void {
    const currentState = this.memory.state.get(node.key);

    if (currentState) {
      currentState.value = value;
      currentState.version += 1;
    } else {
      this.memory.state.set(node.key, {
        version: 0,
        value,
      });
    }

    this.runUpdate(node, notify);
  }

  computeNode<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = getNodeInstance(this.memory, node),
  ): S {
    // Get the current getterVersion handle
    const { getterVersion } = actualNode;

    return createNodeValue<S, A>(
      node,
      {
        get: (dependency) => {
          // Read dependency state
          const currentState = this.getNodeState(dependency);
          // If the getterVersion is still alive, register dependency
          if (getterVersion.alive) {
            registerNodeDependency(this.memory, node, dependency, actualNode);
          }
          return currentState;
        },
        mutate: (target, value) => {
          if (getterVersion.alive) {
            this.setNodeState(target, value);
          }
        },
        mutateSelf: (value) => {
          if (getterVersion.alive) {
            this.setNodeState(node, value);
          }
        },
        setSelf: (action: A) => {
          // If the getterVersion is still alive, schedule a state update.
          if (getterVersion.alive) {
            this.runDispatch(node, action, actualNode);
          }
        },
        set: (target, action) => {
          if (getterVersion.alive) {
            this.runDispatch(target, action);
          }
        },
        reset: (target) => {
          if (getterVersion.alive) {
            this.runCompute(target);
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
      },
    );
  }

  subscribe<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    listener: GraphNodeListener<S>,
  ): () => void {
    const actualNode = getNodeInstance(this.memory, node);
    actualNode.listeners.add(listener);

    return () => {
      actualNode.listeners.delete(listener);
    };
  }

  private batched: [GraphNodeListener<any>, any][] = [];

  private isBatching = 0;

  runDispatch<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    action: A,
    actualNode = getNodeInstance(this.memory, node),
  ): void {
    // Get instance node
    const currentState = this.getNodeState(node);

    if (node.set) {
      // Deprecate setter version
      deprecateNodeSetterVersion(this.memory, node, actualNode);

      const { setterVersion } = actualNode;
      // Run the node setter for further effects
      node.set({
        get: (target) => this.getNodeState(target),
        set: (target, targetAction) => {
          if (setterVersion.alive) {
            this.runDispatch(target, targetAction);
          }
        },
        setSelf: (targetAction) => {
          if (setterVersion.alive) {
            this.runDispatch(node, targetAction, actualNode);
          }
        },
        mutate: (target, targetValue) => {
          if (setterVersion.alive) {
            this.setNodeState(target, targetValue);
          }
        },
        mutateSelf: (targetValue) => {
          if (setterVersion.alive) {
            this.setNodeState(node, targetValue);
          }
        },
        reset: (target) => {
          if (setterVersion.alive) {
            this.runCompute(target);
          }
        },
      }, action);
    } else {
      // Notify for new node value
      this.setNodeState(
        node,
        getDraftState(
          action as unknown as GraphNodeDraftState<S>,
          currentState,
        ),
      );
    }
  }

  runCompute<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = getNodeInstance(this.memory, node),
  ): void {
    /**
     * Clean the previous version to prevent
     * asynchronous dependency registration.
     */
    deprecateNodeGetterVersion(this.memory, node, actualNode);
    /**
     * Set the new node value by recomputing the node.
     * This may recursively compute.
     */
    this.setNodeState(
      node,
      this.computeNode(node, actualNode),
    );
  }

  runUpdate<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    notify = true,
    actualNode = getNodeInstance(this.memory, node),
  ): void {
    const nodeValue = this.getNodeState(node);

    const parent = this.isBatching;
    this.isBatching = parent + 1;

    actualNode.dependents.forEach((dependent) => {
      this.runCompute(dependent);
    });

    actualNode.listeners.forEach((subscriber) => {
      this.batched.push([subscriber, nodeValue]);
    });

    this.isBatching = parent;

    if (this.isBatching === 0) {
      if (notify) {
        this.batched.forEach(([subscriber, value]) => {
          subscriber(value);
        });
      }
      this.batched = [];

      if (process.env.NODE_ENV !== 'production') {
        exposeToWindow(this.memory);
      }
    }
  }

  destroy(): void {
    this.memory.nodes.forEach((node) => {
      node.getterVersion.cleanups.forEach((cleanup) => {
        cleanup();
      });
    });

    this.memory.nodes.clear();
  }

  hasNode<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): boolean {
    return this.memory.nodes.has(node.key);
  }

  hasNodeState<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): boolean {
    return this.memory.state.has(node.key);
  }

  getVersion<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): number {
    return this.getNodeStateRef(node).version;
  }
}
