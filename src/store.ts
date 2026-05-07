import { useSyncExternalStore } from "react";

export interface Store<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
  setState(updater: (prev: T) => T): void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState: (updater) => {
      state = updater(state);
      // Snapshot before notifying — a listener that subscribes/unsubscribes during
      // notification mutates the live Set, but iteration is over the clone.
      for (const l of [...listeners]) l();
    },
  };
}

/**
 * Subscribes to a slice of store state. The selector MUST return a stable reference
 * across calls when the underlying state is unchanged — return primitives or values
 * already stored on state. Returning a freshly-allocated object/array each call will
 * trigger React's "getSnapshot should be cached" warning and infinite re-renders.
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
    () => selector(store.getSnapshot()),
  );
}
