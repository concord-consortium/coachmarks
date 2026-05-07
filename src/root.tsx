import type { EngineLiveState } from "./engine-state";
import { OutlineRings } from "./outline-ring";
import { Popover } from "./popover";
import { type Store, useStore } from "./store";

interface RootProps {
  store: Store<EngineLiveState>;
  container: HTMLElement;
}

export function Root({ store, container }: RootProps) {
  const active = useStore(store, (s) => s.active);
  const popovers = useStore(store, (s) => s.currentPopovers);
  const dismissed = useStore(store, (s) => s.dismissedPopoverIndices);
  if (!active || popovers.length === 0) return null;
  return (
    <>
      <OutlineRings store={store} container={container} />
      {popovers.map((spec, i) => {
        if (dismissed.has(i)) return null;
        // Key by shape (anchored vs viewport) as well as index so that a
        // re-entrant highlight() that flips a slot from one shape to the
        // other forces a remount — useFloating's whileElementsMounted
        // (autoUpdate) is bound to its first invocation and won't re-subscribe
        // on a persistent instance.
        const shape = spec.element ? "anchored" : "viewport";
        return (
          <Popover
            key={`${i}:${shape}`}
            store={store}
            popoverIndex={i}
            container={container}
          />
        );
      })}
    </>
  );
}
