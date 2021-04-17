import {
  trigger as swrTrigger,
  mutate as swrMutate,
  subscribe as swrSubscribe,
  MutationResult,
} from 'swr-store';
import { getKey } from './utils';

export function mutate<S>(key: string, data: MutationResult<S>, shouldRevalidate = true): void {
  return swrMutate(getKey(key), data, shouldRevalidate);
}

export function trigger(key: string, shouldRevalidate = true): void {
  return swrTrigger(getKey(key), shouldRevalidate);
}

export function subscribe<S>(
  key: string,
  listener: (value: MutationResult<S>) => void,
): () => void {
  return swrSubscribe<S>(key, (value) => {
    listener(value.result);
  });
}
