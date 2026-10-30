import { describe, expect, it } from "vitest";
import { detectSwipe } from "./swipe";

const at = (x: number, y: number, t = 0) => ({ x, y, t });

describe("detectSwipe", () => {
  it("swipe left goes to the next step, swipe right goes back", () => {
    expect(detectSwipe(at(300, 400), at(150, 410, 200))).toBe("next");
    expect(detectSwipe(at(50, 400), at(220, 390, 200))).toBe("back");
  });
  it("ignores scrolling and diagonal drags", () => {
    expect(detectSwipe(at(200, 600), at(190, 200, 200))).toBeNull();
    expect(detectSwipe(at(300, 400), at(200, 340, 200))).toBeNull();
  });
  it("ignores short or slow movements", () => {
    expect(detectSwipe(at(200, 400), at(160, 400, 100))).toBeNull();
    expect(detectSwipe(at(300, 400), at(100, 400, 1500))).toBeNull();
  });
});
