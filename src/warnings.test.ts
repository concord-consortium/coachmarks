import { describe, expect, it } from "vitest";
import { warnings } from "./warnings";

describe("warnings", () => {
  it("each builder returns a non-empty string", () => {
    for (const builder of Object.values(warnings) as Array<
      (...args: unknown[]) => string
    >) {
      const out = builder("x", 0);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it("postDestroy interpolates the method name", () => {
    expect(warnings.postDestroy("drive")).toContain("drive");
    expect(warnings.postDestroy("refresh")).toContain("refresh");
  });

  it("moveToOutOfBounds interpolates idx and max", () => {
    expect(warnings.moveToOutOfBounds(7, 3)).toContain("7");
    expect(warnings.moveToOutOfBounds(7, 3)).toContain("3");
  });

  it("companionDropped names the index", () => {
    expect(warnings.companionDropped(2)).toContain("2");
  });

  it("elementPositionCollision interpolates location", () => {
    expect(warnings.elementPositionCollision("step 0")).toContain("step 0");
  });

  it("titleHeadingLevelInvalid interpolates the bad value", () => {
    expect(warnings.titleHeadingLevelInvalid(7)).toContain("7");
    expect(warnings.titleHeadingLevelInvalid("foo")).toContain("foo");
  });
});
