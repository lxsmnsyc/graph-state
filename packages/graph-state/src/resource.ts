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

export interface ResourceFailure<F> {
  status: 'failure';
  data: F;
}

export type ResourceResult<S, F> =
  | ResourcePending<S>
  | ResourceSuccess<S>
  | ResourceFailure<F>;

export type GraphNodePromise<S> = GraphNode<Promise<S>, any, any>;
export type GraphNodeResource<S, F> = GraphNode<ResourceResult<S, F>, any, any>;

function promiseToResource<S, F>(
  promise: Promise<S>,
  mutate: GraphNodeContext<ResourceResult<S, F>, any, any>['mutateSelf'],
): ResourceResult<S, F> {
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
export function resource<S, F>(
  reference: GraphNodePromise<S>,
): GraphNodeAtom<ResourceResult<S, F>> {
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
export function createGraphNodeResource<S, F>(
  reference: GraphNodePromise<S>,
): GraphNodeAtom<ResourceResult<S, F>> {
  return resource(reference);
}

/**
 * Converts a Resource graph node to a Promise-returning graph node
 * @param resource
 */
export function fromResource<S, F>(
  reference: GraphNodeResource<S, F>,
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

function joinResourceKeys<S, F>(
  resources: GraphNodeResource<S, F>[],
): string {
  return resources.map((reference) => reference.key).join(', ');
}

/**
 * Waits for all Resource graph node to resolve.
 * Similar behavior with Promise.all
 * @param resources
 */
export function waitForAll<S, F>(
  resources: GraphNodeResource<S, F>[],
): GraphNodeAtom<ResourceResult<S[], F>> {
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
export function waitForAny<S, F>(
  resources: GraphNodeResource<S, F>[],
): GraphNodeAtom<ResourceResult<S, F>> {
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
export function joinResources<S, F>(
  resources: GraphNodeResource<S, F>[],
): GraphNodeAtom<ResourceResult<S, F>[]> {
  return node({
    get: ({ get }) => resources.map((reference) => get(reference)),
    key: `JoinedResource(${joinResourceKeys(resources)})`,
  });
}

export type GraphNodeResourceFactory<S, F, P extends any[] = []> =
  GraphNodeAtomFactory<ResourceResult<S, F>, P>;

export function createGraphNodeResourceFactory<S, F, P extends any[] = []>(
  factory: GraphNodeBaseFactory<Promise<S>, P>,
): GraphNodeResourceFactory<S, F, P> {
  return (...params: P) => resource(
    factory(...params),
  );
}
