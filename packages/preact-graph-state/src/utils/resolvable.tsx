export interface Resolvable {
  promise: Promise<void>;
  resolve: () => void;
}

export default function createResolvable(): Resolvable {
  let resolve = () => {
    //
  };

  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve,
  };
}
