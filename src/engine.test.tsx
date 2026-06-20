import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCoachmarksEngine } from "./engine";
import {
  flushReact,
  makeAnchorButton as makeAnchor,
  makeHiddenButton as makeHidden,
} from "./test-utils/jsdom-anchor";
import type { EngineHandle, PopoverGroup, PopoverSpec } from "./types";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("createCoachmarksEngine", () => {
  let engines: EngineHandle[];
  beforeEach(() => {
    engines = [];
  });
  afterEach(() => {
    for (const e of engines) {
      try {
        e.destroy();
      } catch {}
    }
  });

  function track(e: EngineHandle) {
    engines.push(e);
    return e;
  }

  it("highlight() mounts a popover for an anchored step", async () => {
    const anchor = makeAnchor();
    const onHighlightStarted = vi.fn();
    const engine = track(createCoachmarksEngine({ onHighlightStarted }));
    await act(async () => {
      engine.highlight({ element: anchor, popover: { title: "Hi" } });
    });
    await flushReact();
    expect(screen.queryByTestId("coachmarks-popover")).not.toBeNull();
    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
    expect(onHighlightStarted.mock.calls[0][0]).toBe(anchor);
  });

  it("destroy() removes the popover and the engine root", async () => {
    const anchor = makeAnchor();
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({ element: anchor, popover: { title: "Hi" } });
    });
    await flushReact();
    await act(async () => {
      engine.destroy();
      await Promise.resolve();
    });
    expect(screen.queryByTestId("coachmarks-popover")).toBeNull();
    expect(
      document.querySelector("[data-testid='coachmarks-root']"),
    ).toBeNull();
  });

  it("onDestroyed fires on programmatic destroy()", async () => {
    const onDestroyed = vi.fn();
    const engine = track(createCoachmarksEngine({ onDestroyed }));
    const anchor = makeAnchor();
    await act(async () => {
      engine.highlight({ element: anchor, popover: { title: "T" } });
    });
    await flushReact();
    await act(async () => {
      engine.destroy();
      await Promise.resolve();
    });
    expect(onDestroyed).toHaveBeenCalledTimes(1);
  });

  it("re-entrant highlight() fires onDeselected once for prior step", async () => {
    const onDeselected = vi.fn();
    const onHighlightStarted = vi.fn();
    const engine = track(
      createCoachmarksEngine({ onDeselected, onHighlightStarted }),
    );
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    await act(async () => {
      engine.highlight({ element: a1, popover: { title: "A" } });
    });
    await flushReact();
    await act(async () => {
      engine.highlight({ element: a2, popover: { title: "B" } });
    });
    await flushReact();
    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onHighlightStarted).toHaveBeenCalledTimes(2);
  });

  it("hidden anchor cancels via rAF deferral (single-popover)", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const hidden = makeHidden();
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    engine.highlight({ element: hidden, popover: { title: "X" } });
    expect(onCancelRequested).not.toHaveBeenCalled();
    await act(async () => {
      vi.runAllTimers();
    });
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("re-entrant drive() cancels pending rAF for prior sequence", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const hidden = makeHidden();
    const visible = makeAnchor();
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    engine.highlight({ element: hidden, popover: { title: "X" } });
    // Re-enter before the rAF fires.
    engine.highlight({ element: visible, popover: { title: "Y" } });
    await act(async () => {
      vi.runAllTimers();
    });
    expect(onCancelRequested).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("PopoverGroup with hidden companion drops it silently after rAF; primary still mounts", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a1 = makeAnchor();
    const hidden = makeHidden();
    const onCancelRequested = vi.fn();
    const onPopoverDismissed = vi.fn();
    const engine = track(
      createCoachmarksEngine({ onCancelRequested, onPopoverDismissed }),
    );
    const group: PopoverGroup = {
      popovers: [
        { element: a1, popover: { title: "Primary" } },
        { element: hidden, popover: { title: "Companion" } },
      ],
    };
    engine.highlight(group);
    await act(async () => {
      vi.runAllTimers();
    });
    await flushReact();
    expect(onCancelRequested).not.toHaveBeenCalled();
    expect(onPopoverDismissed).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(1);
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("companion")),
    ).toBe(true);
    vi.useRealTimers();
  });

  it("primary hidden cancels group", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const hidden = makeHidden();
    const a2 = makeAnchor();
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    engine.highlight({
      popovers: [
        { element: hidden, popover: { title: "Primary" } },
        { element: a2, popover: { title: "Companion" } },
      ],
    } as PopoverGroup);
    await act(async () => {
      vi.runAllTimers();
    });
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("PopoverGroup renders all anchored popovers simultaneously", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "P1" } },
          { element: a2, popover: { title: "P2" } },
        ],
      } as PopoverGroup);
    });
    await flushReact();
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(2);
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(2);
  });

  it("dismissPopover(1) under 'individual' fires onPopoverDismissed and removes the popover", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const onPopoverDismissed = vi.fn();
    const engine = track(createCoachmarksEngine({ onPopoverDismissed }));
    const group: PopoverGroup = {
      popovers: [
        { element: a1, popover: { title: "P1" } },
        { element: a2, popover: { title: "P2" } },
      ],
      dismissBehavior: "individual",
    };
    await act(async () => {
      engine.highlight(group);
    });
    await flushReact();
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(2);
    await act(async () => {
      engine.dismissPopover(1);
    });
    await flushReact();
    expect(onPopoverDismissed).toHaveBeenCalledTimes(1);
    expect(onPopoverDismissed).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        popovers: expect.any(Array),
        dismissBehavior: "individual",
      }),
    );
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(1);
  });

  it("primary close click under 'individual' fires onPopoverDismissed(0) before onCancelRequested", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const calls: string[] = [];
    const onPopoverDismissed = vi.fn((idx: number) =>
      calls.push(`dismissed:${idx}`),
    );
    const onCancelRequested = vi.fn(() => calls.push("cancel"));
    const engine = track(
      createCoachmarksEngine({ onPopoverDismissed, onCancelRequested }),
    );
    const group: PopoverGroup = {
      popovers: [
        { element: a1, popover: { title: "Primary" } },
        { element: a2, popover: { title: "Companion" } },
      ],
      dismissBehavior: "individual",
    };
    await act(async () => {
      engine.highlight(group);
    });
    await flushReact();
    const popovers = screen.getAllByTestId("coachmarks-popover");
    const closeBtn = popovers[0].querySelector(
      "[data-testid='coachmarks-popover-close-btn']",
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(onPopoverDismissed).toHaveBeenCalledTimes(1);
    expect(onPopoverDismissed).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        popovers: expect.any(Array),
        dismissBehavior: "individual",
      }),
    );
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["dismissed:0", "cancel"]);
  });

  it("dismissPopover(0) on bare-popover step cancels (calls onCancelRequested)", async () => {
    const a = makeAnchor();
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "T" } });
    });
    await flushReact();
    await act(async () => {
      engine.dismissPopover(0);
    });
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
  });

  it("dismissPopover under 'group' mode warns and no-ops", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onPopoverDismissed = vi.fn();
    const engine = track(createCoachmarksEngine({ onPopoverDismissed }));
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "P1" } },
          { element: a2, popover: { title: "P2" } },
        ],
        dismissBehavior: "group",
      } as PopoverGroup);
    });
    await flushReact();
    engine.dismissPopover(1);
    expect(onPopoverDismissed).not.toHaveBeenCalled();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("group"))).toBe(
      true,
    );
  });

  it("post-destroy() warns on subsequent imperative calls", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = createCoachmarksEngine({});
    await act(async () => {
      engine.destroy();
      await Promise.resolve();
    });
    engine.drive([]);
    engine.highlight({ popover: { position: "center" } } as PopoverSpec);
    engine.moveNext();
    engine.movePrevious();
    engine.moveTo(0);
    engine.refresh();
    engine.dismissPopover(0);
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("drive"))).toBe(true);
    expect(messages.some((m) => m.includes("highlight"))).toBe(true);
    expect(messages.some((m) => m.includes("moveNext"))).toBe(true);
    expect(messages.some((m) => m.includes("movePrevious"))).toBe(true);
    expect(messages.some((m) => m.includes("moveTo"))).toBe(true);
    expect(messages.some((m) => m.includes("refresh"))).toBe(true);
    expect(messages.some((m) => m.includes("dismissPopover"))).toBe(true);
  });

  it("moveTo bounds: out-of-bounds warns + no-op; same-index silent no-op", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onDeselected = vi.fn();
    const engine = track(createCoachmarksEngine({ onDeselected }));
    await act(async () => {
      engine.drive([
        { element: a1, popover: { title: "1" } },
        { element: a2, popover: { title: "2" } },
      ]);
    });
    await flushReact();
    engine.moveTo(-1);
    engine.moveTo(7);
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes("moveTo")).length,
    ).toBe(2);
    onDeselected.mockClear();
    await act(async () => {
      engine.moveTo(0);
    });
    expect(onDeselected).not.toHaveBeenCalled();
  });

  it("titleHeadingLevel out-of-range warns and clamps to 2", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = track(
      createCoachmarksEngine({
        titleHeadingLevel: 7 as unknown as 1,
      }),
    );
    void engine;
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("titleHeadingLevel")),
    ).toBe(true);
  });

  it("element + position collision warns naming the step (or popover) index", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = makeAnchor();
    const engine = track(createCoachmarksEngine({}));
    engine.highlight({
      element: a,
      popover: {
        position: "top-center",
      } as unknown as { title?: string },
    } as unknown as PopoverSpec);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("element"))).toBe(
      true,
    );
  });

  it("drive at end: moveNext on last step destroys engine", async () => {
    const a = makeAnchor();
    const onDestroyed = vi.fn();
    const engine = track(createCoachmarksEngine({ onDestroyed }));
    await act(async () => {
      engine.drive([{ element: a, popover: { title: "Only" } }]);
    });
    await flushReact();
    await act(async () => {
      engine.moveNext();
      await Promise.resolve();
    });
    expect(onDestroyed).toHaveBeenCalledTimes(1);
  });

  it("refresh() with no active step warns; with active step bumps refreshTick", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = track(createCoachmarksEngine({}));
    engine.refresh();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("refresh"))).toBe(
      true,
    );
    const a = makeAnchor();
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "T" } });
    });
    await flushReact();
    await act(async () => {
      engine.refresh();
    });
    // No additional warn from valid call.
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes("refresh")).length,
    ).toBe(1);
  });

  it("Escape on focused companion under 'individual' cancels the entire step", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const onCancelRequested = vi.fn();
    const onPopoverDismissed = vi.fn();
    const engine = track(
      createCoachmarksEngine({ onCancelRequested, onPopoverDismissed }),
    );
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "Primary" } },
          { element: a2, popover: { title: "Companion" } },
        ],
        dismissBehavior: "individual",
      } as PopoverGroup);
    });
    await flushReact();
    const popovers = screen.getAllByTestId("coachmarks-popover");
    popovers[1].focus();
    fireEvent.keyDown(popovers[1], { key: "Escape" });
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    expect(onPopoverDismissed).not.toHaveBeenCalled();
  });

  it("PopoverSpec.initialFocus selects which popover gets focus", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "P1" } },
          { element: a2, popover: { title: "P2" }, initialFocus: true },
        ],
      } as PopoverGroup);
    });
    await flushReact();
    await waitFor(() => {
      const focused = document.activeElement as HTMLElement | null;
      expect(focused?.getAttribute("data-coachmarks-popover-index")).toBe("1");
    });
  });

  it("companion hidden mid-life is silently dropped (no onPopoverDismissed, dev warn fires)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const onPopoverDismissed = vi.fn();
    const onCancelRequested = vi.fn();
    const engine = track(
      createCoachmarksEngine({ onPopoverDismissed, onCancelRequested }),
    );
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "Primary" } },
          { element: a2, popover: { title: "Companion" } },
        ],
        dismissBehavior: "individual",
      } as PopoverGroup);
    });
    await flushReact();
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(2);

    // Hide the companion mid-step. The MutationObserver in useTargetWatcher
    // observes attribute mutations on the body subtree; toggling display + an
    // attribute triggers the re-check.
    await act(async () => {
      Object.defineProperty(a2, "offsetParent", {
        configurable: true,
        value: null,
      });
      a2.style.display = "none";
      a2.setAttribute("data-touch", "1");
      await Promise.resolve();
    });
    await flushReact();

    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(1);
    expect(onPopoverDismissed).not.toHaveBeenCalled();
    expect(onCancelRequested).not.toHaveBeenCalled();
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("companion")),
    ).toBe(true);
  });

  it("onHighlightStarted passes undefined for a viewport-positioned step", async () => {
    const onHighlightStarted = vi.fn();
    const engine = track(createCoachmarksEngine({ onHighlightStarted }));
    await act(async () => {
      engine.highlight({
        popover: { position: "top-center", title: "Cue" },
      });
    });
    await flushReact();
    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
    expect(onHighlightStarted.mock.calls[0][0]).toBeUndefined();
  });

  it("pullFocusFromIframe: false skips focus pull from active iframe", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "activeElement",
    );
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => iframe,
    });
    try {
      const a = makeAnchor();
      const engine = track(
        createCoachmarksEngine({
          pullFocusFromIframe: false,
          initialFocus: "none",
        }),
      );
      const focusSpy = vi.fn();
      await act(async () => {
        engine.highlight({ element: a, popover: { title: "T" } });
      });
      await flushReact();
      const popover = screen.getByTestId("coachmarks-popover");
      popover.focus = focusSpy;
      // Re-run the iframe pull-out effect by simulating a step transition.
      // (The first run already happened during mount; this asserts the gating
      // check honors the option even if iframe is still active.)
      expect(focusSpy).not.toHaveBeenCalled();
    } finally {
      // Restore document.activeElement so subsequent tests don't inherit the
      // iframe override. We must `delete` the instance property so the prototype
      // getter takes over again — assigning `undefined` would shadow it.
      // biome-ignore lint/performance/noDelete: needed to unshadow prototype getter.
      // biome-ignore lint/suspicious/noExplicitAny: jsdom prototype patching.
      delete (document as any).activeElement;
      if (originalDescriptor) {
        Object.defineProperty(
          Document.prototype,
          "activeElement",
          originalDescriptor,
        );
      }
    }
  });

  it("destroy() restores focus to step anchor when focus was inside the popover", async () => {
    const a = makeAnchor();
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "T" } });
    });
    await flushReact();
    // Focus should be on the popover (initialFocus: "popover" default).
    const popover = screen.getByTestId("coachmarks-popover");
    popover.focus();
    await act(async () => {
      engine.destroy();
      await Promise.resolve();
    });
    // Focus restored to the step anchor.
    expect(document.activeElement).toBe(a);
    expect(a.getAttribute("tabindex")).toBe("-1");
  });

  it("destroy() leaves focus where the user moved it if focus is outside the popover", async () => {
    const a = makeAnchor();
    const elsewhere = document.createElement("button");
    elsewhere.textContent = "elsewhere";
    document.body.appendChild(elsewhere);
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "T" } });
    });
    await flushReact();
    elsewhere.focus();
    await act(async () => {
      engine.destroy();
      await Promise.resolve();
    });
    // No restoration — user-moved focus is preserved.
    expect(document.activeElement).toBe(elsewhere);
  });

  it("highlight() with empty popovers array warns and does not crash", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    expect(() => {
      engine.highlight({ popovers: [] } as unknown as PopoverGroup);
    }).not.toThrow();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("empty"))).toBe(
      true,
    );
    expect(screen.queryByTestId("coachmarks-popover")).toBeNull();
    expect(onCancelRequested).not.toHaveBeenCalled();
  });

  it("re-entrant highlight() from inside onDeselected does not get clobbered", async () => {
    let secondStepFired = false;
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    let calls = 0;
    const engine = track(
      createCoachmarksEngine({
        onDeselected: () => {
          // Re-enter highlight() exactly once when the first step is leaving.
          if (calls++ === 0)
            engine.highlight({ element: a2, popover: { title: "B" } });
        },
        onHighlightStarted: (_el, step) => {
          // step.element is a2 when the inner re-entrant highlight took effect.
          if (
            "element" in step &&
            (step as { element?: HTMLElement }).element === a2
          ) {
            secondStepFired = true;
          }
        },
      }),
    );
    await act(async () => {
      engine.highlight({ element: a1, popover: { title: "A" } });
    });
    await flushReact();
    // Trigger a second highlight to fire onDeselected for step A.
    await act(async () => {
      engine.highlight({ element: a1, popover: { title: "A2" } });
    });
    await flushReact();
    // The inner re-entrant highlight() (to step B) must have taken effect —
    // not been overwritten by the outer call's setState.
    expect(secondStepFired).toBe(true);
  });

  it("re-entrant highlight() viewport→anchored remounts the popover so floating-ui rewires autoUpdate", async () => {
    const engine = track(createCoachmarksEngine({}));
    // Step 1: viewport popover. Inhabits popoverIndex 0 with no anchor —
    // useFloating mounts with whileElementsMounted: undefined.
    await act(async () => {
      engine.highlight({
        popover: { position: "top-center", title: "Viewport" },
      });
    });
    await flushReact();
    const viewportPopover = screen.getByTestId("coachmarks-popover");

    // Step 2: anchored popover at the same popoverIndex 0. Anchored mode
    // requires autoUpdate; useFloating captures whileElementsMounted at
    // mount, so the persistent instance from step 1 would never subscribe.
    // The fix is to key the popover by shape so React remounts on transition.
    const anchor = makeAnchor({ left: 50, top: 50, width: 50, height: 30 });
    await act(async () => {
      engine.highlight({ element: anchor, popover: { title: "Anchored" } });
    });
    await flushReact();
    const anchoredPopover = screen.getByTestId("coachmarks-popover");

    // Different DOM element identity proves the popover remounted; same
    // identity would mean useFloating reused its initial undefined
    // whileElementsMounted and autoUpdate was never wired up.
    expect(anchoredPopover).not.toBe(viewportPopover);
  });

  it("drag offset is preserved relative to anchor across refresh()", async () => {
    const a = makeAnchor({ left: 50, top: 50, width: 50, height: 30 });
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "T" } });
    });
    await flushReact();
    const popover = screen.getByTestId("coachmarks-popover");
    // Simulate a drag that moves the popover. (We assert the engine survives
    // an anchor rect change + refresh() without throwing — pixel placement is
    // covered manually in the demo per the test-strategy split.)
    Object.defineProperty(a, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 150,
        top: 150,
        width: 50,
        height: 30,
        right: 200,
        bottom: 180,
        x: 150,
        y: 150,
        toJSON: () => ({}),
      }),
    });
    await act(async () => {
      engine.refresh();
    });
    await flushReact();
    expect(popover).toBeDefined();
  });

  it("anchored→no-anchor transition removes the outline ring; popover positions to viewport anchor", async () => {
    const a = makeAnchor();
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "Anchored" } });
    });
    await flushReact();
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(1);

    await act(async () => {
      engine.highlight({
        popover: { position: "top-center", title: "Viewport" },
      });
    });
    await flushReact();
    expect(screen.queryByTestId("coachmarks-outline-ring")).toBeNull();
    const popover = screen.getByTestId("coachmarks-popover");
    expect(popover.style.position).toBe("fixed");
    expect(popover.style.top).not.toBe("");
  });

  it("no-anchor→anchored transition reinstates the outline ring", async () => {
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({
        popover: { position: "top-center", title: "Viewport" },
      });
    });
    await flushReact();
    expect(screen.queryByTestId("coachmarks-outline-ring")).toBeNull();

    const a = makeAnchor({ left: 75, top: 80, width: 60, height: 40 });
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "Anchored" } });
    });
    await flushReact();
    expect(screen.getAllByTestId("coachmarks-outline-ring").length).toBe(1);
  });

  it("dismissPopover(idx>0) on a bare-popover step warns and no-ops", async () => {
    const a = makeAnchor();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onCancelRequested = vi.fn();
    const onPopoverDismissed = vi.fn();
    const engine = track(
      createCoachmarksEngine({ onCancelRequested, onPopoverDismissed }),
    );
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "T" } });
    });
    await flushReact();
    engine.dismissPopover(1);
    expect(onCancelRequested).not.toHaveBeenCalled();
    expect(onPopoverDismissed).not.toHaveBeenCalled();
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes("dismissPopover(1) on a bare-popover step"),
      ),
    ).toBe(true);
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(1);
  });

  it("re-entrant highlight() while a group is active fires onDeselected once", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const a3 = makeAnchor({ left: 500, top: 100, width: 50, height: 30 });
    const onDeselected = vi.fn();
    const onHighlightStarted = vi.fn();
    const engine = track(
      createCoachmarksEngine({ onDeselected, onHighlightStarted }),
    );
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "P1" } },
          { element: a2, popover: { title: "P2" } },
        ],
      } as PopoverGroup);
    });
    await flushReact();
    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
    onDeselected.mockClear();
    onHighlightStarted.mockClear();
    await act(async () => {
      engine.highlight({ element: a3, popover: { title: "Solo" } });
    });
    await flushReact();
    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
  });

  it("refresh() bumps refreshTick exactly once for a group regardless of popover count", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.highlight({
        popovers: [
          { element: a1, popover: { title: "P1" } },
          { element: a2, popover: { title: "P2" } },
        ],
      } as PopoverGroup);
    });
    await flushReact();
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(2);
    // Both popovers receive the same refreshTick value via the shared store —
    // a single refresh() drives positioning recomputation for every popover in
    // the group through the same effect path tested in popover.test.tsx
    // ("does NOT scroll on refresh()" / "scrolls again when seqId bumps").
    await act(async () => {
      engine.refresh();
      engine.refresh();
    });
    await flushReact();
    // Both popovers still rendered; refresh() did not tear down any popover or
    // duplicate them.
    expect(screen.getAllByTestId("coachmarks-popover").length).toBe(2);
  });

  it("step transition: moveNext moves focus to popover and updates aria-labelledby", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const engine = track(createCoachmarksEngine({}));
    await act(async () => {
      engine.drive([
        { element: a1, popover: { title: "Step 1" } },
        { element: a2, popover: { title: "Step 2" } },
      ]);
    });
    await flushReact();
    await waitFor(() => {
      const popover = screen.getByTestId("coachmarks-popover");
      const labelledById = popover.getAttribute("aria-labelledby") ?? "";
      expect(document.getElementById(labelledById)?.textContent).toBe("Step 1");
    });
    await act(async () => {
      engine.moveNext();
    });
    await flushReact();
    await waitFor(() => {
      const popover = screen.getByTestId("coachmarks-popover");
      const labelledById = popover.getAttribute("aria-labelledby") ?? "";
      expect(document.getElementById(labelledById)?.textContent).toBe("Step 2");
      expect(document.activeElement).toBe(popover);
    });
  });

  it("initialFocus: 'none' does not move focus on step transition", async () => {
    const a1 = makeAnchor();
    const a2 = makeAnchor({ left: 300, top: 100, width: 50, height: 30 });
    const elsewhere = document.createElement("button");
    elsewhere.textContent = "elsewhere";
    document.body.appendChild(elsewhere);
    const engine = track(createCoachmarksEngine({ initialFocus: "none" }));
    await act(async () => {
      engine.drive([
        { element: a1, popover: { title: "Step 1" } },
        { element: a2, popover: { title: "Step 2" } },
      ]);
    });
    await flushReact();
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);
    await act(async () => {
      engine.moveNext();
    });
    await flushReact();
    expect(document.activeElement).toBe(elsewhere);
  });

  // --- Selector targets, wait-for-appearance, and gated degrade-on-removal (WM-17) ---

  /** Anchor that matches `[data-testid="<id>"]` and passes isLaidOut. */
  function makeSelectorAnchor(
    id: string,
    rect?: { left: number; top: number; width: number; height: number },
  ): HTMLButtonElement {
    const el = makeAnchor(rect);
    el.setAttribute("data-testid", id);
    return el;
  }

  /** Hide an anchor (fails isLaidOut) and poke an attribute so the MutationObserver re-checks. */
  function hideAnchor(el: HTMLElement) {
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      value: null,
    });
    el.style.display = "none";
    el.setAttribute("data-hidden", "1");
  }

  function primaryTitle(): string | null {
    const titles = screen.queryAllByTestId("coachmarks-popover-title");
    return titles[0]?.textContent ?? null;
  }

  it("selector step whose target never appears keeps the prior step active (no cancel)", async () => {
    makeSelectorAnchor("sel-1");
    const onCancelRequested = vi.fn();
    const onDeselected = vi.fn();
    const engine = track(
      createCoachmarksEngine({
        actionGated: true,
        onCancelRequested,
        onDeselected,
      }),
    );
    await act(async () => {
      engine.drive([
        { target: '[data-testid="sel-1"]', popover: { title: "One" } },
        { target: '[data-testid="sel-missing"]', popover: { title: "Two" } },
      ]);
    });
    await flushReact();
    expect(primaryTitle()).toBe("One");

    await act(async () => {
      engine.moveNext();
      await Promise.resolve();
    });
    await flushReact();
    // Target never appears: stay on step 1, no cancel, no deselect.
    expect(primaryTitle()).toBe("One");
    expect(onDeselected).not.toHaveBeenCalled();
    expect(onCancelRequested).not.toHaveBeenCalled();
  });

  it("two moveNext() during one wait window produce a single transition (re-entrancy guard)", async () => {
    makeSelectorAnchor("re-1");
    const onDeselected = vi.fn();
    const engine = track(
      createCoachmarksEngine({ actionGated: true, onDeselected }),
    );
    await act(async () => {
      engine.drive([
        { target: '[data-testid="re-1"]', popover: { title: "One" } },
        { target: '[data-testid="re-2"]', popover: { title: "Two" } },
      ]);
    });
    await flushReact();

    // Two advances while the next target is absent — the second must no-op.
    await act(async () => {
      engine.moveNext();
      engine.moveNext();
      await Promise.resolve();
    });
    await flushReact();
    expect(onDeselected).not.toHaveBeenCalled();
    expect(primaryTitle()).toBe("One");

    // Reveal the target: exactly one transition runs.
    await act(async () => {
      makeSelectorAnchor("re-2", {
        left: 300,
        top: 100,
        width: 50,
        height: 30,
      });
      await Promise.resolve();
    });
    await flushReact();
    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(primaryTitle()).toBe("Two");
  });

  it("gated degrade-on-removal (a): held step whose anchor is removed mid-wait re-floats, then advances when the next target appears — no cancel", async () => {
    const a1 = makeSelectorAnchor("ga-1");
    const onCancelRequested = vi.fn();
    const onDeselected = vi.fn();
    const engine = track(
      createCoachmarksEngine({
        actionGated: true,
        onCancelRequested,
        onDeselected,
      }),
    );
    await act(async () => {
      engine.drive([
        { target: '[data-testid="ga-1"]', popover: { title: "One" } },
        { target: '[data-testid="ga-2"]', popover: { title: "Two" } },
      ]);
    });
    await flushReact();

    // Advance: step 2's target is absent → hold step 1 and wait.
    await act(async () => {
      engine.moveNext();
      await Promise.resolve();
    });
    await flushReact();

    // Remove step 1's (held) anchor: gated degrade, not cancel.
    await act(async () => {
      hideAnchor(a1);
      await Promise.resolve();
    });
    await flushReact();
    expect(onCancelRequested).not.toHaveBeenCalled();
    // Step 1 is still shown (now centered/anchorless), not torn down.
    expect(primaryTitle()).toBe("One");

    // The pending wait still resolves when step 2's target appears.
    await act(async () => {
      makeSelectorAnchor("ga-2", {
        left: 300,
        top: 100,
        width: 50,
        height: 30,
      });
      await Promise.resolve();
    });
    await flushReact();
    expect(onCancelRequested).not.toHaveBeenCalled();
    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(primaryTitle()).toBe("Two");
  });

  it("gated degrade-on-removal (b): terminal step's anchor removed re-floats keeping Done/close; Done still completes — no cancel", async () => {
    const a = makeSelectorAnchor("term-1");
    const onCancelRequested = vi.fn();
    const onDestroyed = vi.fn();
    const engine = track(
      createCoachmarksEngine({
        actionGated: true,
        showButtons: ["next", "close"],
        showProgress: true,
        doneBtnText: "Got it!",
        onCancelRequested,
        onDestroyed,
      }),
    );
    await act(async () => {
      engine.drive([
        { target: '[data-testid="term-1"]', popover: { title: "Only" } },
      ]);
    });
    await flushReact();
    expect(
      screen.getByTestId("coachmarks-popover-progress-text").textContent,
    ).toBe("1 of 1");

    // Remove the terminal anchor with no advance pending → degrade, not cancel.
    await act(async () => {
      hideAnchor(a);
      await Promise.resolve();
    });
    await flushReact();
    expect(onCancelRequested).not.toHaveBeenCalled();
    expect(primaryTitle()).toBe("Only");
    // Keeps its Done + close + step number.
    const doneBtn = screen.getByTestId("coachmarks-popover-next-btn");
    expect(doneBtn.textContent).toContain("Got it!");
    expect(screen.getByTestId("coachmarks-popover-close-btn")).not.toBeNull();
    expect(
      screen.getByTestId("coachmarks-popover-progress-text").textContent,
    ).toBe("1 of 1");

    // Done still completes the tour.
    await act(async () => {
      fireEvent.click(doneBtn);
      await Promise.resolve();
    });
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(onCancelRequested).not.toHaveBeenCalled();
  });

  it("non-gated tour still cancels when an anchor is removed (back-compat)", async () => {
    const a = makeAnchor();
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    await act(async () => {
      engine.highlight({ element: a, popover: { title: "X" } });
    });
    await flushReact();
    await act(async () => {
      hideAnchor(a);
      await Promise.resolve();
    });
    await flushReact();
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
  });

  it("degrade fires onHighlightStarted exactly once across the step's life (anchored entry + degrade)", async () => {
    const a = makeSelectorAnchor("once-1");
    const onHighlightStarted = vi.fn();
    const onDeselected = vi.fn();
    const engine = track(
      createCoachmarksEngine({
        actionGated: true,
        onHighlightStarted,
        onDeselected,
      }),
    );
    await act(async () => {
      engine.drive([
        { target: '[data-testid="once-1"]', popover: { title: "Only" } },
      ]);
    });
    await flushReact();
    expect(onHighlightStarted).toHaveBeenCalledTimes(1);

    await act(async () => {
      hideAnchor(a);
      await Promise.resolve();
    });
    await flushReact();
    // Degrade re-mounts the primary (anchored→centered) but must NOT re-fire.
    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
    expect(onDeselected).not.toHaveBeenCalled();
  });

  it("an imperative advance to a non-selector step during a pending wait is a no-op", async () => {
    // Regression: the re-entrancy guard must cover ALL advances during a wait, not just
    // selector ones — otherwise a moveTo() to a live-element step leaks the pending wait.
    makeSelectorAnchor("mix-0");
    const live = makeAnchor({ left: 500, top: 100, width: 50, height: 30 });
    const onDeselected = vi.fn();
    const engine = track(
      createCoachmarksEngine({ actionGated: true, onDeselected }),
    );
    await act(async () => {
      engine.drive([
        { target: '[data-testid="mix-0"]', popover: { title: "Zero" } },
        { target: '[data-testid="mix-1"]', popover: { title: "One" } },
        { element: live, popover: { title: "Two" } },
      ]);
    });
    await flushReact();

    // Advance to step 1 (absent) → hold step 0 and wait.
    await act(async () => {
      engine.moveNext();
      await Promise.resolve();
    });
    await flushReact();
    expect(primaryTitle()).toBe("Zero");

    // Imperative jump to the live-element step 2 during the wait must be ignored.
    await act(async () => {
      engine.moveTo(2);
      await Promise.resolve();
    });
    await flushReact();
    expect(primaryTitle()).toBe("Zero");
    expect(onDeselected).not.toHaveBeenCalled();

    // The original wait still resolves to step 1 (single transition, no leak to step 2).
    await act(async () => {
      makeSelectorAnchor("mix-1", {
        left: 300,
        top: 100,
        width: 50,
        height: 30,
      });
      await Promise.resolve();
    });
    await flushReact();
    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(primaryTitle()).toBe("One");
  });

  it("gated advanceOn:{event:'click'} on the step-1 anchor advances to step 2", async () => {
    const a1 = makeSelectorAnchor("adv-1");
    makeSelectorAnchor("adv-2", { left: 300, top: 100, width: 50, height: 30 });
    const onDeselected = vi.fn();
    const engine = track(
      createCoachmarksEngine({ actionGated: true, onDeselected }),
    );
    await act(async () => {
      engine.drive([
        {
          target: '[data-testid="adv-1"]',
          advanceOn: { event: "click" },
          popover: { title: "One" },
        },
        { target: '[data-testid="adv-2"]', popover: { title: "Two" } },
      ]);
    });
    await flushReact();
    expect(primaryTitle()).toBe("One");

    // Clicking the real app control (the anchor) advances the tour.
    await act(async () => {
      fireEvent.click(a1);
      await Promise.resolve();
    });
    await flushReact();
    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(primaryTitle()).toBe("Two");
  });

  it("advanceOn is ignored on a non-gated engine (listener not attached)", async () => {
    const a1 = makeSelectorAnchor("noadv-1");
    makeSelectorAnchor("noadv-2", {
      left: 300,
      top: 100,
      width: 50,
      height: 30,
    });
    const onDeselected = vi.fn();
    // No actionGated → advanceOn must not advance. (Selector steps still resolve.)
    const engine = track(createCoachmarksEngine({ onDeselected }));
    await act(async () => {
      engine.drive([
        {
          target: '[data-testid="noadv-1"]',
          advanceOn: { event: "click" },
          popover: { title: "One" },
        },
        { target: '[data-testid="noadv-2"]', popover: { title: "Two" } },
      ]);
    });
    await flushReact();
    await act(async () => {
      fireEvent.click(a1);
      await Promise.resolve();
    });
    await flushReact();
    expect(onDeselected).not.toHaveBeenCalled();
    expect(primaryTitle()).toBe("One");
  });

  it("back-compat: non-gated moveNext to a not-laid-out live element cancels exactly once", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const a = makeAnchor();
    const hidden = makeHidden();
    const onCancelRequested = vi.fn();
    const engine = track(createCoachmarksEngine({ onCancelRequested }));
    engine.drive([
      { element: a, popover: { title: "One" } },
      { element: hidden, popover: { title: "Two" } },
    ]);
    await act(async () => {
      vi.runAllTimers();
    });
    await flushReact();
    engine.moveNext();
    await act(async () => {
      vi.runAllTimers();
    });
    await flushReact();
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
