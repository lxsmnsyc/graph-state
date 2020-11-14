import {
  GraphNodeGetInterface,
  GraphNodeResource,
  GraphNodeResourceFactory,
} from 'graph-state';
import {
  MutationResult,
  MutationListener,
} from './cache/mutation-cache';

export type SWRGraphNodeRawValue<T> = T | Promise<T>;

export interface SWRGraphNodeBaseOptions {
  revalidateOnFocus: boolean;
  revalidateOnVisibility: boolean;
  revalidateOnNetwork: boolean;

  refreshWhenOffline: boolean;
  refreshWhenHidden: boolean;
  refreshWhenBlurred: boolean;

  freshAge: number;
  staleAge: number;
}

export type SWRGraphNodePartialOptions = Partial<SWRGraphNodeBaseOptions>;

export type SWRGraphNodeFetcher<T> =
  (methods: GraphNodeGetInterface<MutationResult<T>>) => SWRGraphNodeRawValue<T>;

export type SWRGraphNodeMutate<T> =
  (value: MutationResult<T>, shouldRevalidate?: boolean) => void;
export type SWRGraphNodeHydrate<T> =
  (value: MutationResult<T>) => void;
export type SWRGraphNodeTrigger =
  (shouldRevalidate?: boolean) => void;
export type SWRGraphNodeSubscribe<T> =
  (listener: MutationListener<T>) => () => void;

export interface SWRGraphNodeInterface<T> {
  mutate: SWRGraphNodeMutate<T>;
  trigger: SWRGraphNodeTrigger;
  resource: GraphNodeResource<T>;
  hydrate: SWRGraphNodeHydrate<T>;
  subscribe: SWRGraphNodeSubscribe<T>;
}

export interface SWRGraphNodeAtomicOptions<T> {
  fetch: SWRGraphNodeFetcher<T>;
  key: string;
  initialData?: T;
  refreshInterval?: number;
}

export type SWRGraphNodeOptions<T> =
  SWRGraphNodePartialOptions & SWRGraphNodeAtomicOptions<T>;

export type SWRGraphNodeFullOptions<T> =
  SWRGraphNodeBaseOptions & SWRGraphNodeAtomicOptions<T>;

export interface SWRGraphNodeFactoryAtomicOptions<T, Args extends any[] = []> {
  fetch: (...args: Args) => SWRGraphNodeFetcher<T>;
  key: (...args: Args) => string;
  initialData?: T;
  refreshInterval?: number;
}

export type SWRGraphNodeFactoryOptions<T, Args extends any[] = []> =
  SWRGraphNodePartialOptions & SWRGraphNodeFactoryAtomicOptions<T, Args>;

export type SWRGraphNodeFactoryFullOptions<T, Args extends any[] = []> =
  SWRGraphNodeBaseOptions & SWRGraphNodeFactoryAtomicOptions<T, Args>;

export type SWRGraphNodeFactoryMutate<T, Args extends any[] = []> =
  (args: Args, value: MutationResult<T>, shouldRevalidate?: boolean) => void;
export type SWRGraphNodeFactoryHydrate<T, Args extends any[] = []> =
(args: Args, value: MutationResult<T>) => void;
export type SWRGraphNodeFactoryTrigger<Args extends any[] = []> =
  (args: Args, shouldRevalidate?: boolean) => void;
export type SWRGraphNodeFactorySubscribe<T, Args extends any[] = []> =
  (args: Args, listener: MutationListener<T>) => () => void;

export interface SWRGraphNodeFactoryInterface<T, Args extends any[] = []> {
  trigger: SWRGraphNodeFactoryTrigger<Args>;
  mutate: SWRGraphNodeFactoryMutate<T, Args>;
  resource: GraphNodeResourceFactory<T, Args>;
  hydrate: SWRGraphNodeFactoryHydrate<T, Args>;
  subscribe: SWRGraphNodeFactorySubscribe<T, Args>;
}
