import { describe, expect, test } from "bun:test";
import {
  DURATION_IN_FRAMES,
  MAX_WORDS,
  MOTION_STYLES,
  clipFits,
  computeWordTimings,
  entranceProgress,
  exitOpacity,
  fnv1a,
  motionAt,
  splitWords,
  styleFromBrief,
  type MotionStyle,
} from "./motion.ts";

describe("styleFromBrief", () => {
  test("empty text stays on pop-in", () => {
    expect(styleFromBrief("")).toBe("pop-in");
    expect(styleFromBrief("   ")).toBe("pop-in");
  });

  test("trims before hashing and stays stable", () => {
    expect(styleFromBrief("  Launch  ")).toBe(styleFromBrief("Launch"));
    expect(styleFromBrief("Launch the quiet version.")).toBe(
      styleFromBrief("Launch the quiet version."),
    );
  });

  test("locks a known brief to its hash bucket", () => {
    const brief = "Launch the quiet version.";
    const index = fnv1a(brief) % MOTION_STYLES.length;
    expect(styleFromBrief(brief)).toBe(MOTION_STYLES[index]);
    expect(fnv1a(brief)).toBe(1983527481);
    expect(styleFromBrief(brief)).toBe("pop-in");
  });

  test("different briefs can resolve to different styles", () => {
    const styles = new Set(
      ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"].map((brief) =>
        styleFromBrief(brief),
      ),
    );
    expect(styles.size).toBeGreaterThan(1);
  });
});

describe("word timing", () => {
  test("splits on whitespace and caps the line", () => {
    expect(splitWords("  one   two  ")).toEqual(["one", "two"]);
    expect(splitWords("")).toEqual([]);
    const many = Array.from({ length: 40 }, (_, index) => `w${index}`).join(" ");
    expect(splitWords(many)).toHaveLength(MAX_WORDS);
  });

  test("staggers words and keeps a single word on the lead", () => {
    const single = computeWordTimings("Only", "pop-in");
    expect(single).toHaveLength(1);
    expect(single[0]?.startFrame).toBe(12);

    const line = computeWordTimings("one two three", "slide-stagger");
    expect(line.map((timing) => timing.startFrame)).toEqual([12, 15, 18]);
    expect(line[0]?.enterFrames).toBe(22);
  });

  test("a full line finishes before the exit hold", () => {
    const text = Array.from({ length: MAX_WORDS }, () => "word").join(" ");
    for (const style of MOTION_STYLES) {
      const timings = computeWordTimings(text, style);
      expect(clipFits(timings)).toBe(true);
      expect(timings[0]?.startFrame).toBeLessThan(timings[1]?.startFrame ?? 0);
    }
  });

  test("compresses stagger when the clip is short", () => {
    const text = Array.from({ length: 16 }, () => "word").join(" ");
    const timings = computeWordTimings(text, "slide-stagger", 96);
    expect(clipFits(timings, 96)).toBe(true);
    const stagger = (timings[1]?.startFrame ?? 0) - (timings[0]?.startFrame ?? 0);
    expect(stagger).toBeLessThan(3);
    expect(stagger).toBeGreaterThan(0);
  });

  test("entrance and exit progress", () => {
    expect(entranceProgress(4, 12, 18)).toBe(0);
    expect(entranceProgress(12, 12, 18)).toBe(0);
    expect(entranceProgress(21, 12, 18)).toBe(0.5);
    expect(entranceProgress(40, 12, 18)).toBe(1);

    expect(exitOpacity(0)).toBe(1);
    expect(exitOpacity(DURATION_IN_FRAMES - 12)).toBe(1);
    expect(exitOpacity(DURATION_IN_FRAMES - 1)).toBe(0);
  });
});

describe("motion poses", () => {
  const styles: MotionStyle[] = ["pop-in", "slide-stagger", "scale-punch"];

  test("starts offset and lands clean", () => {
    for (const style of styles) {
      const start = motionAt(style, 0);
      const end = motionAt(style, 1);
      expect(start.opacity).toBe(0);
      expect(end.opacity).toBe(1);
      expect(end.x).toBeCloseTo(0, 4);
      expect(end.y).toBeCloseTo(0, 4);
      expect(end.scale).toBeCloseTo(1, 4);
      expect(Math.abs(start.x)).toBeLessThanOrEqual(32);
      expect(Math.abs(start.y)).toBeLessThanOrEqual(20);
    }
  });

  test("slide travels on x, pop on y, punch only scales", () => {
    expect(motionAt("slide-stagger", 0).x).toBe(32);
    expect(motionAt("slide-stagger", 0).y).toBe(0);
    expect(motionAt("pop-in", 0).y).toBe(20);
    expect(motionAt("pop-in", 0).x).toBe(0);
    expect(motionAt("scale-punch", 0).scale).toBeCloseTo(0.88, 4);
    expect(motionAt("scale-punch", 0).x).toBe(0);
    expect(motionAt("scale-punch", 0).y).toBe(0);
  });

  test("punch overshoots by a small amount, then returns to 1", () => {
    let peak = 0;
    for (let step = 0; step <= 20; step++) {
      peak = Math.max(peak, motionAt("scale-punch", step / 20).scale);
    }
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.03);
    expect(motionAt("scale-punch", 1).scale).toBeCloseTo(1, 4);
  });
});
