export function getKey(key: string): string {
  return `/swr-graph-state/${key}`;
}
export function ensure<T>(value: T | undefined): T {
  if (value == null) {
    throw new Error('Unable to return a nullish value.');
  }
  return value;
}
