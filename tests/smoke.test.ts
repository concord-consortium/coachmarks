import { createCoachmarksEngine } from "@concord-consortium/coachmarks";
import { describe, expect, it } from "vitest";
// Theme-stylesheet subpath imports prove the exports map resolves. If the
// exports map is broken or a stylesheet is missing from dist/, the test file
// fails to load with a module-resolution error before any test runs.
import "@concord-consortium/coachmarks/styles/hazbot";
import "@concord-consortium/coachmarks/styles/codap";

describe("packaging smoke test", () => {
  it("createCoachmarksEngine is callable from the published entrypoint", () => {
    const engine = createCoachmarksEngine({});
    expect(typeof engine.drive).toBe("function");
    expect(typeof engine.highlight).toBe("function");
    expect(typeof engine.destroy).toBe("function");
    expect(typeof engine.dismissPopover).toBe("function");
    engine.destroy();
  });
});
