import { describe, expect, it } from "vitest";
import { clampFloatingNavigationPosition } from "./MobileFloatingNavigation";

describe("clampFloatingNavigationPosition", () => {
  it("keeps the floating button inside a mobile viewport", () => {
    expect(clampFloatingNavigationPosition({ x: -30, y: 900 }, 390, 844)).toEqual({
      x: 12,
      y: 772
    });
  });

  it("preserves a position already inside the viewport", () => {
    expect(clampFloatingNavigationPosition({ x: 280, y: 400 }, 390, 844)).toEqual({
      x: 280,
      y: 400
    });
  });
});
