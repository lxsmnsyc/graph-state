import {
  GraphNode,
  GraphNodeAtom,
  GraphNodeAtomFactory,
  GraphNodeBaseFactory,
  GraphNodeContext,
  node,
} from './graph-node';

export interface ResourcePending<S> {
  status: 'pending';
  data: Promise<S>;
}

export interface ResourceSuccess<S> {
  status: 'success';
  data: S;
}

export interface ResourceFailure {
  status: 'failure';
  data: any;
}

export type ResourceResult<S> =
  | ResourcePending<S>
  | ResourceSuccess<S>
  | ResourceFailure;

export type GraphNodePromise<S> = GraphNode<Promise<S>, any, any>;
export type GraphNodeResource<S> = GraphNode<ResourceResult<S>, any, any>;

function promiseToResource<S>(
  promise: Promise<S>,
  mutate: GraphNodeContext<ResourceResult<S>, any, any>['mutateSelf'],
): ResourceResult<S> {
  promise.then(
    (data) => mutate({
      status: 'success',
      data,
    }),
    (data) => mutate({
      status: 'failure',
      data,
    }),
  );

  return {
    data: promise,
    status: 'pending',
  };
}

/**
 * Converts a Promise-returning graph node into a Resource graph node
 */
export function resource<S>(
  reference: GraphNodePromise<S>,
): GraphNodeAtom<ResourceResult<S>> {
  return node({
    get: (context) => (
      promiseToResource(
        context.get(reference),
        (value) => context.mutateSelf(value),
      )
    ),
    key: `Resource(${reference.key})`,
  });
}

/**
 * Converts a Promise-returning graph node into a Resource graph node
 * @deprecated Please use `resource`
 */
export function createGraphNodeResource<S>(
  reference: GraphNodePromise<S>,
): GraphNodeAtom<ResourceResult<S>> {
  return resource(reference);
}

/**
 * Converts a Resource graph node to a Promise-returning graph node
 * @param resource
 */
export function fromResource<S>(
  reference: GraphNodeResource<S>,
): GraphNodeAtom<Promise<S>> {
  return node({
    get: async (context) => {
      const result = context.get(reference);

      if (result.status === 'failure') {
        throw result.data;
      }
      return result.data;
    },
    key: `Promise(${reference.key})`,
  });
}

function joinResourceKeys<S>(
  resources: GraphNodeResource<S>[],
): string {
  return resources.map((reference) => reference.key).join(', ');
}

/**
 * Waits for all Resource graph node to resolve.
 * Similar behavior with Promise.all
 * @param resources
 */
export function waitForAll<S>(
  resources: GraphNodeResource<S>[],
): GraphNodeAtom<ResourceResult<S[]>> {
  const promises = resources.map((reference) => fromResource(reference));

  return node({
    get: ({ get, mutateSelf }) => (
      promiseToResource(
        Promise.all(
          promises.map((promise) => get(promise)),
        ),
        mutateSelf,
      )
    ),
    key: `WaitForAll(${joinResourceKeys(resources)})`,
  });
}

/**
 * Waits for any Resource graph node to resolve.
 * Similar behavior with Promise.race
 * @param resources
 */
export function waitForAny<S>(
  resources: GraphNodeResource<S>[],
): GraphNodeAtom<ResourceResult<S>> {
  const promises = resources.map((reference) => fromResource(reference));

  return node({
    get: ({ get, mutateSelf }) => (
      promiseToResource(
        Promise.race(
          promises.map((promise) => get(promise)),
        ),
        mutateSelf,
      )
    ),
    key: `WaitForAny(${joinResourceKeys(resources)})`,
  });
}

/**
 * Joins Resource graph nodes into a graph node that returns
 * an array of resources
 * @param resources
 */
export function joinResources<S>(
  resources: GraphNodeResource<S>[],
): GraphNodeAtom<ResourceResult<S>[]> {
  return node({
    get: ({ get }) => resources.map((reference) => get(reference)),
    key: `JoinedResource(${joinResourceKeys(resources)})`,
  });
}

export type GraphNodeResourceFactory<S, P extends any[] = []> =
  GraphNodeAtomFactory<ResourceResult<S>, P>;

export function resourceFactory<S, P extends any[] = []>(
  factory: GraphNodeBaseFactory<Promise<S>, P>,
): GraphNodeResourceFactory<S, P> {
  return (...params: P) => resource(
    factory(...params),
  );
}

/**
 * @deprecated
 */
export function createGraphNodeResourceFactory<S, P extends any[] = []>(
  factory: GraphNodeBaseFactory<Promise<S>, P>,
): GraphNodeResourceFactory<S, P> {
  return resourceFactory(factory);
}
