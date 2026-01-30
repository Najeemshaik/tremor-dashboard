export type StoreSubscriber = () => void;
export type EqualityFn<T> = (a: T, b: T) => boolean;

export type Store<T> = {
  getState: () => T;
  update: (updater: (state: T) => void) => void;
  subscribe: (listener: StoreSubscriber) => () => void;
  notify: () => void;
  subscribeSelector: <U>(
    selector: (state: T) => U,
    listener: (next: U, prev: U) => void,
    compare?: EqualityFn<U>
  ) => () => void;
};

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const subscribers = new Set<StoreSubscriber>();

  const notify = () => {
    subscribers.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    update: (updater) => {
      updater(state);
      notify();
    },
    subscribe: (listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    notify,
    subscribeSelector: (selector, listener, compare = Object.is) => {
      let prev = selector(state);
      const wrapped = () => {
        const next = selector(state);
        if (!compare(prev, next)) {
          const last = prev;
          prev = next;
          listener(next, last);
        }
      };
      subscribers.add(wrapped);
      return () => subscribers.delete(wrapped);
    }
  };
}

export function shallowEqualArray<T>(a: T[] | null | undefined, b: T[] | null | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

export function shallowEqualObject<T extends Record<string, unknown>>(
  a: T | null | undefined,
  b: T | null | undefined
) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}
