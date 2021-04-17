import {
  GraphNodeAtomAction,
  GraphNodeContext, GraphNodeResource, GraphNodeResourceFactory,
} from 'graph-state';
import {
  MutationResult,
  SWRStoreOptions,
} from 'swr-store';

export type SWRGraphNodeFetch<S> = () => Promise<S>;
export type SWRGraphNodeSetup<S> = (
  (context: GraphNodeContext<MutationResult<S>, GraphNodeAtomAction<MutationResult<S>>, void>)
    => SWRGraphNodeFetch<S>
);

export interface SWRGraphNodeOptions<S>
  extends Omit<SWRStoreOptions<S>, 'get' | 'key'> {
  key: string;
  setup: SWRGraphNodeSetup<S>;
}

export interface SWRGraphNodeFactoryOptions<S, P extends any[] = []>
  extends Omit<SWRStoreOptions<S>, 'get' | 'key'> {
  factoryKey: string,
  key: (...args: P) => string;
  setup: (...args: P) => SWRGraphNodeSetup<S>;
}

export interface SWRGraphNode<S> {
  resource: GraphNodeResource<S>;
  subscribe: (listener: (result: MutationResult<S>) => void) => () => void;
  trigger: (shouldRevalidate?: boolean) => void;
  mutate: (data: MutationResult<S>, shouldRevalidate?: boolean) => void;
}

export interface SWRGraphNodeFactory<S, P extends any[] = []> {
  resource: GraphNodeResourceFactory<S, P>;
  subscribe: (args: P, listener: (result: MutationResult<S>) => void) => () => void;
  trigger: (args: P, shouldRevalidate?: boolean) => void;
  mutate: (args: P, data: MutationResult<S>, shouldRevalidate?: boolean) => void;
}
