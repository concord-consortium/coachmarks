import {
  FloatingArrow,
  FloatingPortal,
  type Middleware,
  type Placement,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { clsx } from "clsx";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type EngineLiveState, dismissBehaviorOf } from "./engine-state";
import { CloseIcon } from "./icons/close";
import { renderMarkdown } from "./markdown";
import { renderProgressText } from "./progress-text";
import { scrollTargetIntoView } from "./scroll-into-view";
import { type Store, useStore } from "./store";
import type {
  AnchoredPopover,
  EngineOptions,
  PopoverSpec,
  ViewportPopover,
  ViewportPosition,
} from "./types";
import { useKeyboardControl } from "./use-keyboard-control";
import { usePopoverDrag } from "./use-popover-drag";
import { useReducedMotion } from "./use-reduced-motion";
import { useTargetWatcher } from "./use-target-watcher";

interface PopoverProps {
  store: Store<EngineLiveState>;
  popoverIndex: number;
  container: HTMLElement;
}

export function Popover({ store, popoverIndex, container }: PopoverProps) {
  const spec = useStore(
    store,
    (s) => (s.currentPopovers[popoverIndex] ?? null) as PopoverSpec | null,
  );
  if (!spec) return null;
  return (
    <PopoverContent
      store={store}
      spec={spec}
      popoverIndex={popoverIndex}
      container={container}
    />
  );
}

interface PopoverContentProps {
  store: Store<EngineLiveState>;
  spec: PopoverSpec;
  popoverIndex: number;
  container: HTMLElement;
}

function isAnchored(spec: PopoverSpec): spec is AnchoredPopover {
  return spec.element != null;
}

/** Maps a cartesian (x = right, y = down) anchor offset to floating-ui's
 *  mainAxis (away from anchor along the placement direction) and crossAxis
 *  (perpendicular) for the resolved placement. Exported for unit testing. */
export function cartesianToAxisOffset(
  baseOffset: number,
  placement: Placement,
  ax: number,
  ay: number,
): { mainAxis: number; crossAxis?: number } {
  const side = placement.split("-")[0];
  switch (side) {
    case "top":
      return { mainAxis: baseOffset - ay, crossAxis: ax };
    case "bottom":
      return { mainAxis: baseOffset + ay, crossAxis: ax };
    case "left":
      return { mainAxis: baseOffset - ax, crossAxis: ay };
    case "right":
      return { mainAxis: baseOffset + ax, crossAxis: ay };
    default:
      return { mainAxis: baseOffset };
  }
}

function computeUserPlacement(
  side: AnchoredPopover["popover"] extends infer P
    ? P extends { side?: infer S }
      ? S
      : never
    : never = "top",
  align: AnchoredPopover["popover"] extends infer P
    ? P extends { align?: infer A }
      ? A
      : never
    : never = "center",
): Placement {
  const s = side ?? "top";
  const a = align ?? "center";
  if (a === "center") return s as Placement;
  return `${s}-${a}` as Placement;
}

// `viewportOffset` semantics: positive x and y are insets *away from the chosen edge*.
// Corners (top-left, top-right, bottom-left, bottom-right): both axes inset from their
// respective edges. Edge midpoints (top-center, bottom-center, middle-left, middle-right):
// the edge-aligned axis insets from that edge; the perpendicular axis is a cartesian
// offset (positive = rightward for x, positive = downward for y). `center` uses cartesian
// offsets on both axes.
function viewportPositionStyles(
  position: ViewportPosition,
  off: { x?: number; y?: number } = {},
): CSSProperties {
  const x = off.x ?? 0;
  const y = off.y ?? 0;
  const base: CSSProperties = { position: "fixed" };
  switch (position) {
    case "top-left":
      return { ...base, top: y, left: x };
    case "top-center":
      return {
        ...base,
        top: y,
        left: "50%",
        transform: `translateX(calc(-50% + ${x}px))`,
      };
    case "top-right":
      return { ...base, top: y, right: x };
    case "middle-left":
      return {
        ...base,
        top: "50%",
        left: x,
        transform: `translateY(calc(-50% + ${y}px))`,
      };
    case "center":
      return {
        ...base,
        top: "50%",
        left: "50%",
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
      };
    case "middle-right":
      return {
        ...base,
        top: "50%",
        right: x,
        transform: `translateY(calc(-50% + ${y}px))`,
      };
    case "bottom-left":
      return { ...base, bottom: y, left: x };
    case "bottom-center":
      return {
        ...base,
        bottom: y,
        left: "50%",
        transform: `translateX(calc(-50% + ${x}px))`,
      };
    case "bottom-right":
      return { ...base, bottom: y, right: x };
    default:
      return base;
  }
}

// Visual port of @floating-ui/react's FloatingArrow for viewport popovers, which have
// no floating-ui context to drive the real component. Same default path, same fill/stroke
// CSS variables, same strokeWidth-doubling and base-stroke-clipping tricks — so the arrow
// looks identical to the anchored variant. No halo path here: the popover's wrapping
// `filter: drop-shadow` traces the combined silhouette (popover rectangle + arrow V) and
// produces the halo around the arrow automatically.

interface ViewportArrowProps {
  side: "top" | "right" | "bottom" | "left";
  offset: number;
  arrowOpts: EngineOptions["arrow"];
}

function ViewportArrow({ side, offset, arrowOpts }: ViewportArrowProps) {
  const width = arrowOpts?.width ?? 14;
  const height = arrowOpts?.height ?? 7;
  const tipRadius = arrowOpts?.tipRadius ?? 0;
  const strokeWidth = arrowOpts?.strokeWidth ?? 1;
  const customD = arrowOpts?.path;
  const clipPathId = useId();

  const computedStrokeWidth = strokeWidth * 2;
  const halfStrokeWidth = computedStrokeWidth / 2;
  const svgX = (width / 2) * (tipRadius / -8 + 1);
  const svgY = ((height / 2) * tipRadius) / 4;
  const isCustomShape = !!customD;
  const isVerticalSide = side === "top" || side === "bottom";

  const dValue =
    customD ??
    `M0,0 H${width} L${width - svgX},${height - svgY} Q${width / 2},${height} ${svgX},${height - svgY} Z`;

  // FloatingArrow's default path points DOWN. For our user-facing `side` (the edge the
  // arrow protrudes from / points away from), pick the rotation that orients the tip
  // outward: top → up, bottom → down (no rotation), left → left, right → right.
  const rotation = {
    top: isCustomShape ? "" : "rotate(180deg)",
    bottom: isCustomShape ? "rotate(180deg)" : "",
    left: isCustomShape ? "rotate(-90deg)" : "rotate(90deg)",
    right: isCustomShape ? "rotate(90deg)" : "rotate(-90deg)",
  }[side];

  // Vertical sides: arrow flush with edge (top/bottom: 100%). Horizontal sides: inset
  // by halfStrokeWidth so the second-path stroke can hide the popover's own border.
  const edgeOffset =
    isVerticalSide || isCustomShape
      ? "100%"
      : `calc(100% - ${halfStrokeWidth}px)`;

  const svgWidth = isCustomShape ? width : width + computedStrokeWidth;
  const halfSvgWidth = svgWidth / 2;

  const style: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    transform: rotation,
  };
  if (side === "top") {
    style.bottom = edgeOffset;
    style.left = `calc(50% - ${halfSvgWidth}px + ${offset}px)`;
  } else if (side === "bottom") {
    style.top = edgeOffset;
    style.left = `calc(50% - ${halfSvgWidth}px + ${offset}px)`;
  } else if (side === "left") {
    style.right = edgeOffset;
    style.top = `calc(50% - ${width / 2}px + ${offset}px)`;
  } else {
    style.left = edgeOffset;
    style.top = `calc(50% - ${width / 2}px + ${offset}px)`;
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`coachmarks-popover-arrow-side-${side}`}
      width={svgWidth}
      height={width}
      viewBox={`0 0 ${width} ${height > width ? height : width}`}
      style={style}
    >
      <defs>
        <clipPath id={clipPathId}>
          <rect
            x={-halfStrokeWidth}
            y={halfStrokeWidth * (isCustomShape ? -1 : 1)}
            width={width + computedStrokeWidth}
            height={width}
          />
        </clipPath>
      </defs>
      {computedStrokeWidth > 0 && (
        <path
          clipPath={`url(#${clipPathId})`}
          fill="none"
          stroke="var(--coachmarks-popover-border)"
          strokeWidth={computedStrokeWidth + (customD ? 0 : 1)}
          d={dValue}
        />
      )}
      <path
        fill="var(--coachmarks-popover-bg)"
        stroke={
          computedStrokeWidth && !customD
            ? "var(--coachmarks-popover-bg)"
            : "none"
        }
        d={dValue}
      />
    </svg>
  );
}

function PopoverContent({
  store,
  spec,
  popoverIndex,
  container,
}: PopoverContentProps) {
  const opts = useStore(store, (s) => s.options);
  const activeIndex = useStore(store, (s) => s.activeIndex);
  const stepsLength = useStore(store, (s) => s.steps.length);
  const kind = useStore(store, (s) => s.kind);
  const refreshTick = useStore(store, (s) => s.refreshTick);
  // seqId bumps on every highlight()/drive() call; included in the activeIndex-keyed
  // effects below so re-entrant highlight() to a new spec retriggers them even when
  // the activeIndex value is unchanged (0 → 0).
  const seqId = useStore(store, (s) => s.seqId);
  const dismissBehavior = useStore(store, (s) =>
    s.currentStep ? dismissBehaviorOf(s.currentStep) : "group",
  );

  const arrowRef = useRef<SVGSVGElement>(null);
  const [popoverEl, setPopoverEl] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const isPrimary = popoverIndex === 0;
  const anchored = isAnchored(spec);

  // Drag (anchored only).
  const dragResetKey = `${activeIndex}:${popoverIndex}`;
  const {
    position: dragPosition,
    isDragging,
    onPointerDown,
  } = usePopoverDrag(dragResetKey, popoverEl);

  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(
    null,
  );
  const [dragVersion, setDragVersion] = useState(0);

  // Reset drag offset on step transition. dragResetKey is the opaque trigger.
  useEffect(() => {
    void dragResetKey;
    dragOffsetRef.current = null;
    setDragVersion((v) => v + 1);
  }, [dragResetKey]);

  // Convert viewport-absolute drag to anchor-relative offset.
  useEffect(() => {
    if (!dragPosition || !anchored) return;
    const r = (spec as AnchoredPopover).element.getBoundingClientRect();
    const wasDragging = dragOffsetRef.current !== null;
    dragOffsetRef.current = {
      offsetX: dragPosition.x - r.left,
      offsetY: dragPosition.y - r.top,
    };
    if (!wasDragging) setDragVersion((v) => v + 1);
    contextRef.current?.update();
  }, [dragPosition, anchored, spec]);

  // Recomputes per pointermove via the dragPosition dep so the arrow re-orients
  // continuously as the user drags around the anchor (matches the demo claim
  // "the arrow re-orients"). dragVersion stays in deps to handle the entering-drag
  // and step-transition transitions where dragPosition alone wouldn't change.
  const dragPlacement = useMemo<Placement | null>(() => {
    void dragVersion;
    void dragPosition;
    const o = dragOffsetRef.current;
    if (!o || !popoverEl || !anchored) return null;
    const anchorEl = (spec as AnchoredPopover).element;
    const r = anchorEl.getBoundingClientRect();
    const popX = r.left + o.offsetX;
    const popY = r.top + o.offsetY;
    const popCx = popX + popoverEl.offsetWidth / 2;
    const popCy = popY + popoverEl.offsetHeight / 2;
    const tCx = r.left + r.width / 2;
    const tCy = r.top + r.height / 2;
    const dx = popCx - tCx;
    const dy = popCy - tCy;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "bottom" : "top";
  }, [dragVersion, dragPosition, popoverEl, anchored, spec]);

  const anchorOffsetX = anchored
    ? ((spec as AnchoredPopover).popover?.anchorOffset?.x ?? 0)
    : 0;
  const anchorOffsetY = anchored
    ? ((spec as AnchoredPopover).popover?.anchorOffset?.y ?? 0)
    : 0;
  const middleware = useMemo<Middleware[]>(() => {
    void dragVersion;
    // Viewport popovers don't use floating-ui positioning (inlineStyles overrides
    // the result), so no middleware is needed.
    if (!anchored) return [];
    if (dragOffsetRef.current) {
      return [
        {
          name: "dragOffset",
          fn: ({ rects }) => {
            const o = dragOffsetRef.current;
            return o
              ? {
                  x: rects.reference.x + o.offsetX,
                  y: rects.reference.y + o.offsetY,
                }
              : {};
          },
        },
        arrow({ element: arrowRef, padding: 4 }),
      ];
    }
    const baseOffset = opts.popoverOffset ?? 10;
    return [
      // anchorOffset is cartesian (x = right, y = down) so it stays consistent
      // even after flip(). Map to floating-ui's mainAxis/crossAxis using the
      // *resolved* placement.
      offset(({ placement }) =>
        cartesianToAxisOffset(
          baseOffset,
          placement,
          anchorOffsetX,
          anchorOffsetY,
        ),
      ),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: arrowRef, padding: 4 }),
    ];
  }, [dragVersion, opts.popoverOffset, anchored, anchorOffsetX, anchorOffsetY]);

  const userPlacement = anchored
    ? computeUserPlacement(
        (spec as AnchoredPopover).popover?.side,
        (spec as AnchoredPopover).popover?.align,
      )
    : ("top" as Placement);

  const { refs, floatingStyles, context, placement, isPositioned } =
    useFloating({
      strategy: "fixed",
      placement: dragPlacement ?? userPlacement,
      middleware,
      whileElementsMounted: anchored ? autoUpdate : undefined,
    });

  const contextRef = useRef(context);
  contextRef.current = context;

  // Set anchored reference on `useFloating`.
  useEffect(() => {
    if (anchored) {
      refs.setReference((spec as AnchoredPopover).element);
    }
  }, [anchored, spec, refs]);

  const setFloating = useCallback(
    (el: HTMLElement | null) => {
      if (anchored) refs.setFloating(el);
      setPopoverEl(el);
    },
    [refs, anchored],
  );

  const arrowSide = (placement.split("-")[0] ?? "top") as
    | "top"
    | "right"
    | "bottom"
    | "left";

  // Iframe focus pull-out — re-runs on every step transition (activeIndex) so a tour that
  // moves through plugin-iframe contexts keeps document-level keydown listeners live.
  const pullFocusFromIframe = opts.pullFocusFromIframe ?? true;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on step entry.
  useEffect(() => {
    if (!popoverEl) return;
    if (pullFocusFromIframe && document.activeElement?.tagName === "IFRAME") {
      popoverEl.focus({ preventScroll: true });
    }
  }, [popoverEl, pullFocusFromIframe, activeIndex, seqId]);

  // initialFocus — runs on every step transition and on initial popover mount.
  // Per-popover override: only the popover whose spec sets initialFocus (or the primary by default) takes focus.
  const initialFocus = opts.initialFocus ?? "popover";
  const currentPopovers = useStore(store, (s) => s.currentPopovers);
  const focusOwnerIndex = useMemo(() => {
    const explicit = currentPopovers.findIndex((p) => p.initialFocus);
    return explicit >= 0 ? explicit : 0;
  }, [currentPopovers]);
  const shouldFocus = popoverIndex === focusOwnerIndex;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on step entry.
  useEffect(() => {
    if (!popoverEl) return;
    if (!shouldFocus) return;
    if (initialFocus === "none") return;
    if (initialFocus === "popover") {
      if (!popoverEl.hasAttribute("tabindex")) {
        popoverEl.setAttribute("tabindex", "-1");
      }
      popoverEl.focus({ preventScroll: true });
      return;
    }
    if (initialFocus === "first-button") {
      const order = [
        ".coachmarks-popover-prev-btn",
        ".coachmarks-popover-next-btn",
        ".coachmarks-popover-close-btn",
      ];
      for (const sel of order) {
        const btn = popoverEl.querySelector<HTMLButtonElement>(sel);
        if (btn && !btn.disabled) {
          btn.focus({ preventScroll: true });
          break;
        }
      }
    }
  }, [popoverEl, initialFocus, shouldFocus, activeIndex, seqId]);

  // Scroll-into-view (anchored only) — runs on every step transition.
  // Intentionally NOT keyed on `opts.smoothScroll` — changing the option mid-step
  // shouldn't replay the scroll. `spec` and `opts.smoothScroll` are read fresh at
  // effect time but only `activeIndex` / `prefersReducedMotion` retrigger.
  const prefersReducedMotion = useReducedMotion();
  // biome-ignore lint/correctness/useExhaustiveDependencies: only retrigger on step change.
  useEffect(() => {
    if (!anchored) return;
    scrollTargetIntoView(
      (spec as AnchoredPopover).element,
      opts.smoothScroll ?? true,
      prefersReducedMotion,
    );
  }, [activeIndex, prefersReducedMotion, seqId]);

  // refresh() consumption — re-run floating-ui positioning.
  useEffect(() => {
    void refreshTick;
    contextRef.current?.update();
  }, [refreshTick]);

  // Fire onHighlightStarted once per step entry, after the popover has mounted
  // and (for anchored steps) floating-ui has computed its first position. Only
  // the primary popover (popoverIndex === 0) fires it; companions never do.
  // Keyed on `${seqId}:${activeIndex}` so each new step entry re-fires exactly
  // once even when the primary's React instance persists across transitions.
  const firedForStepRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPrimary) return;
    if (!popoverEl) return;
    if (anchored && !isPositioned) return;
    const key = `${seqId}:${activeIndex}`;
    if (firedForStepRef.current === key) return;
    firedForStepRef.current = key;
    const s = store.getSnapshot();
    if (!s.currentStep) return;
    const primaryAnchor = s.currentPopovers[0]?.element;
    s.callbacks.onHighlightStarted?.(primaryAnchor, s.currentStep, {
      state: { activeIndex },
    });
  }, [isPrimary, popoverEl, anchored, isPositioned, seqId, activeIndex, store]);

  // Target watcher (anchored only).
  const onTargetRemoved = useCallback(() => {
    // Involuntary hides: a primary anchor going hidden cancels the entire step
    // (no nav owner without it); a companion anchor going hidden under "individual"
    // mode drops just that companion silently — without firing onPopoverDismissed,
    // which is reserved for user-initiated close-button clicks and consumer-imperative
    // dismissPopover() calls. Group mode treats any hidden anchor as a cancel.
    const s = store.getSnapshot();
    if (!s.currentStep) return;
    const behavior = dismissBehaviorOf(s.currentStep);
    if (behavior === "individual" && popoverIndex > 0) {
      s.dropCompanionSilently(popoverIndex);
    } else {
      s.cancel();
    }
  }, [store, popoverIndex]);
  // Viewport popovers have no anchor to watch; pass null so the hook short-circuits.
  useTargetWatcher(
    anchored ? (spec as AnchoredPopover).element : null,
    onTargetRemoved,
  );

  // Close-button onClick: bare-popover and "group" steps cancel the step directly;
  // "individual"-mode groups route every popover (primary or companion) through
  // dismissPopover so the engine fires onPopoverDismissed for the dismissed index —
  // and on the primary, follows it with onCancelRequested.
  const onCloseClick = useCallback(() => {
    const s = store.getSnapshot();
    if (dismissBehavior === "group") s.cancel();
    else s.dismissPopover(popoverIndex);
  }, [store, dismissBehavior, popoverIndex]);

  // Keyboard control. Escape always cancels the entire step regardless of which popover
  // (primary or companion) currently holds focus — the keyboard listener is attached only
  // to the primary, so this callback is bound to the primary's instance and `cancel()` is
  // the right action whether focus is on the primary or a companion.
  const onKeyboardClose = useCallback(() => {
    store.getSnapshot().cancel();
  }, [store]);

  useKeyboardControl({
    enabled: (opts.allowKeyboardControl ?? true) && isPrimary,
    allowClose: opts.allowClose ?? true,
    popoverEl,
    onNext: () => store.getSnapshot().moveNext(),
    onPrev: () => store.getSnapshot().movePrevious(),
    onClose: onKeyboardClose,
  });

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === stepsLength - 1;
  const showButtons = opts.showButtons ?? ["next", "previous", "close"];
  const disabled = new Set(opts.disableButtons ?? []);
  const animationsDisabled = opts.animate === false;
  const draggable = (opts.draggable ?? true) && anchored;

  const popoverClass = clsx(
    "coachmarks-popover",
    draggable && "coachmarks-popover--draggable",
    isDragging && "coachmarks-popover--dragging",
    (prefersReducedMotion || animationsDisabled) &&
      "coachmarks-popover--reduced-motion",
  );

  const popoverContent = spec.popover;
  const hasTitle = Boolean(popoverContent?.title);
  const hasDescription = Boolean(popoverContent?.description);
  const ariaLabelOption = opts.ariaLabel ?? "Help";
  const titleHeadingLevel = opts.titleHeadingLevel ?? 2;
  const TitleTag = `h${titleHeadingLevel}` as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";

  const closeIcon = opts.closeIcon ?? (
    <CloseIcon className="coachmarks-popover-close-icon" />
  );
  const closeBtnAriaLabel = opts.closeBtnAriaLabel ?? "Close";

  // For anchored popovers, hide until floating-ui has computed its first position —
  // otherwise the popover renders briefly at (0,0) before the transform updates,
  // producing a visible jump on every step entry. Using opacity (rather than
  // visibility/display) keeps the popover queryable by role for a11y tests.
  const viewportArrow = anchored
    ? null
    : ((spec as ViewportPopover).popover.arrow ?? null);
  const hideUntilPositioned = anchored && !isPositioned;
  const inlineStyles: CSSProperties = anchored
    ? {
        ...floatingStyles,
        ...(hideUntilPositioned ? { opacity: 0, pointerEvents: "none" } : null),
      }
    : viewportPositionStyles(
        (spec as ViewportPopover).popover.position,
        (spec as ViewportPopover).popover.viewportOffset,
      );
  const widthOverride = spec.popover?.width;
  if (widthOverride != null) {
    inlineStyles.width = widthOverride;
    inlineStyles.maxWidth = widthOverride;
  }

  return (
    <FloatingPortal root={container}>
      <div
        ref={setFloating}
        style={inlineStyles}
        // biome-ignore lint/a11y/useSemanticElements: <dialog> would introduce top-layer / ::backdrop / inert behavior that conflicts with FloatingPortal positioning; <div role="dialog" aria-modal="false"> gives the SR semantic without those side effects.
        role="dialog"
        aria-modal="false"
        {...(hasTitle
          ? { "aria-labelledby": titleId }
          : { "aria-label": ariaLabelOption })}
        {...(hasDescription ? { "aria-describedby": descriptionId } : {})}
        tabIndex={-1}
        className={popoverClass}
        data-testid="coachmarks-popover"
        data-coachmarks-popover-index={popoverIndex}
        onPointerDown={draggable ? onPointerDown : undefined}
      >
        <div className="coachmarks-popover-content">
          {hasTitle && (
            <TitleTag
              className="coachmarks-popover-title"
              id={titleId}
              data-testid="coachmarks-popover-title"
            >
              {popoverContent?.title}
            </TitleTag>
          )}
          {hasDescription && (
            <p
              className="coachmarks-popover-description"
              id={descriptionId}
              data-testid="coachmarks-popover-description"
            >
              {(opts.parseMarkdown ?? true)
                ? renderMarkdown(popoverContent?.description ?? "")
                : popoverContent?.description}
            </p>
          )}
          {isPrimary && (
            <div className="coachmarks-popover-buttons">
              {opts.showProgress && kind === "tour" && (
                <div
                  className="coachmarks-popover-progress-text"
                  data-testid="coachmarks-popover-progress-text"
                >
                  {renderProgressText(
                    opts.progressText,
                    activeIndex + 1,
                    stepsLength,
                  )}
                </div>
              )}
              <div className="coachmarks-popover-button-group">
                {showButtons.includes("previous") && !isFirst && (
                  <button
                    type="button"
                    className="coachmarks-popover-prev-btn"
                    data-testid="coachmarks-popover-prev-btn"
                    disabled={disabled.has("previous")}
                    onClick={() => store.getSnapshot().movePrevious()}
                  >
                    {opts.prevBtnText ?? "Previous"}
                  </button>
                )}
                {showButtons.includes("next") && (
                  <button
                    type="button"
                    className="coachmarks-popover-next-btn"
                    data-testid="coachmarks-popover-next-btn"
                    disabled={disabled.has("next")}
                    onClick={() => store.getSnapshot().moveNext()}
                  >
                    {isLast
                      ? (opts.doneBtnText ?? "Done")
                      : (opts.nextBtnText ?? "Next")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {showButtons.includes("close") && (opts.allowClose ?? true) && (
          <button
            type="button"
            aria-label={closeBtnAriaLabel}
            className="coachmarks-popover-close-btn"
            data-testid="coachmarks-popover-close-btn"
            onClick={onCloseClick}
          >
            {closeIcon}
          </button>
        )}
        {anchored && (
          <FloatingArrow
            ref={arrowRef}
            context={context}
            className={`coachmarks-popover-arrow-side-${arrowSide}`}
            fill="var(--coachmarks-popover-bg)"
            stroke="var(--coachmarks-popover-border)"
            strokeWidth={opts.arrow?.strokeWidth ?? 1}
            width={opts.arrow?.width}
            height={opts.arrow?.height}
            tipRadius={opts.arrow?.tipRadius}
            d={opts.arrow?.path}
          />
        )}
        {!anchored && viewportArrow && (
          <ViewportArrow
            side={viewportArrow.side}
            offset={viewportArrow.offset ?? 0}
            arrowOpts={opts.arrow}
          />
        )}
      </div>
    </FloatingPortal>
  );
}
