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
  version: GraphNodeVersion;
  setterVersion: GraphNodeBaseVersion;
  listeners: GraphNodeListeners<T>;
  dependents: GraphNodeDependencies;
}

export interface GraphNodeState<T> {
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

function createNodeVersion(): GraphNodeVersion {
  return {
    alive: true,
    dependencies: new Set(),
    cleanups: [],
  };
}

function createNodeBaseVersion(): GraphNodeBaseVersion {
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
    dependencies: parseDependencies(value.version.dependencies),
  }));
}

function exposeToWindow(
  memory: GraphDomainMemory,
): void {
  if (typeof window !== 'undefined') {
    window.withGraphStateDomainMemory = parseGraphDomainMemory(memory);
  }
}

export default class GraphCore {
  public memory: GraphDomainMemory;

  constructor() {
    this.memory = createGraphDomainMemory();
  }

  getNodeInstance<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): GraphNodeInstance<S> {
    const currentNode = this.memory.nodes.get(node.key);

    if (!currentNode) {
      const baseNode: GraphNodeInstance<S> = {
        version: {
          alive: true,
          dependencies: new Set(),
          cleanups: [],
        },
        setterVersion: {
          alive: true,
        },
        listeners: new Set(),
        dependents: new Set(),
      };

      this.memory.nodes.set(node.key, baseNode);

      return baseNode;
    }

    return currentNode;
  }

  getNodeState<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
  ): S {
    const currentState = this.memory.state.get(node.key);

    if (currentState) {
      return currentState.value;
    }

    const newState = {
      value: this.computeNode(node),
    };

    this.memory.state.set(node.key, newState);

    return newState.value;
  }

  setNodeState<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    value: S,
    notify = true,
  ): void {
    const currentState = this.memory.state.get(node.key);

    if (currentState) {
      currentState.value = value;
    } else {
      this.memory.state.set(node.key, {
        value,
      });
    }

    if (notify) {
      this.runUpdate(node);
    }
  }

  computeNode<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = this.getNodeInstance(node),
  ): S {
    // Get the current version handle
    const { version } = actualNode;

    return createNodeValue<S, A>(
      node,
      {
        get: (dependency) => {
          // Read dependency state
          const currentState = this.getNodeState(dependency);
          // If the version is still alive, register dependency
          if (version.alive) {
            this.registerNodeDependency(node, dependency, actualNode);
          }
          return currentState;
        },
        mutate: (target, value) => {
          if (version.alive) {
            this.setNodeState(target, value);
          }
        },
        mutateSelf: (value) => {
          if (version.alive) {
            this.setNodeState(node, value);
          }
        },
        setSelf: (action: A) => {
          // If the version is still alive, schedule a state update.
          if (version.alive) {
            this.runDispatch(node, action);
          }
        },
        set: (target, action) => {
          if (version.alive) {
            this.runDispatch(target, action);
          }
        },
        reset: (target) => {
          if (version.alive) {
            this.runCompute(target);
          }
        },
        subscription: (callback) => {
          if (version.alive) {
            const cleanup = callback();

            if (cleanup) {
              version.cleanups.push(cleanup);
            }
          }
        },
      },
    );
  }

  registerNodeListener<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    listener: GraphNodeListener<S>,
    actualNode = this.getNodeInstance(node),
  ): void {
    actualNode.listeners.add(listener);
  }

  unregisterNodeListener<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    listener: GraphNodeListener<S>,
    actualNode = this.getNodeInstance(node),
  ): void {
    actualNode.listeners.delete(listener);
  }

  registerNodeDependency<S, A, R, T>(
    node: GraphNode<S, A>,
    dependency: GraphNode<R, T>,
    actualNode = this.getNodeInstance(node),
  ): void {
    actualNode.version.dependencies.add(dependency);

    this.getNodeInstance(dependency).dependents.add(node);
  }

  unregisterNodeDependency<S, A, R, T>(
    node: GraphNode<S, A>,
    dependency: GraphNode<R, T>,
    actualNode = this.getNodeInstance(node),
  ): void {
    actualNode.version.dependencies.delete(dependency);

    this.getNodeInstance(dependency).dependents.delete(node);
  }

  deprecateNodeVersion<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = this.getNodeInstance(node),
  ): void {
    actualNode.version.dependencies.forEach((dependency) => {
      this.unregisterNodeDependency(dependency, node);
    });
    actualNode.version.cleanups.forEach((cleanup) => {
      cleanup();
    });
    actualNode.version.alive = false;
    actualNode.version = createNodeVersion();
  }

  deprecateNodeBaseVersion<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = this.getNodeInstance(node),
  ): void {
    actualNode.setterVersion.alive = false;
    actualNode.setterVersion = createNodeBaseVersion();
  }

  private batched: [GraphNodeListener<any>, any][] = [];

  private isBatching = 0;

  runDispatch<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    action: A,
    actualNode = this.getNodeInstance(node),
  ): void {
    // Get instance node
    const currentState = this.getNodeState(node);

    if (node.set) {
      // Deprecate setter version
      this.deprecateNodeBaseVersion(node);

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
            this.runDispatch(node, targetAction);
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

    if (process.env.NODE_ENV !== 'production') {
      exposeToWindow(this.memory);
    }
  }

  runCompute<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = this.getNodeInstance(node),
  ): void {
    /**
     * Clean the previous version to prevent
     * asynchronous dependency registration.
     */
    this.deprecateNodeVersion(node);
    /**
     * Set the new node value by recomputing the node.
     * This may recursively compute.
     */
    this.setNodeState(
      node,
      this.computeNode(node, actualNode),
    );

    if (process.env.NODE_ENV !== 'production') {
      exposeToWindow(this.memory);
    }
  }

  runUpdate<S, A = GraphNodeDraftState<S>>(
    node: GraphNode<S, A>,
    actualNode = this.getNodeInstance(node),
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
      this.batched.forEach(([subscriber, value]) => {
        subscriber(value);
      });
      this.batched = [];
    }

    if (process.env.NODE_ENV !== 'production') {
      exposeToWindow(this.memory);
    }
  }

  destroy(): void {
    this.memory.nodes.forEach((node) => {
      node.version.cleanups.forEach((cleanup) => {
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
}
