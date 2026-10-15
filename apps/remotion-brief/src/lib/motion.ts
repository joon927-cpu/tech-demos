export const FPS = 60;
export const DURATION_IN_FRAMES = FPS * 4;
export const MAX_WORDS = 24;

export const MOTION_STYLES = ["pop-in", "slide-stagger", "scale-punch"] as const;
export type MotionStyle = (typeof MOTION_STYLES)[number];

export const STYLE_LABEL: Record<MotionStyle, string> = {
  "pop-in": "Pop-in",
  "slide-stagger": "Slide",
  "scale-punch": "Punch",
};

const LEAD_FRAMES = 12;
const EXIT_FRAMES = 12;
const MIN_HOLD_FRAMES = 30;

const PREFERRED: Record<MotionStyle, { stagger: number; enter: number }> = {
  "pop-in": { stagger: 3, enter: 18 },
  "slide-stagger": { stagger: 3, enter: 22 },
  "scale-punch": { stagger: 3, enter: 14 },
};

export type WordTiming = {
  word: string;
  index: number;
  startFrame: number;
  enterFrames: number;
};

export type MotionPose = {
  opacity: number;
  x: number;
  y: number;
  scale: number;
};

type Bezier = (x: number) => number;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Bezier {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 6; i++) {
      const slope = sampleDX(t);
      if (Math.abs(slope) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - (sampleX(t) - x) / slope));
    }

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (sampleX(mid) < x) lo = mid;
      else hi = mid;
    }

    return sampleY((lo + hi) / 2);
  };
}

// Expo-out: the move answers immediately and settles. Exit is a shorter ease-in.
const easeOut = cubicBezier(0.16, 1, 0.3, 1);
const easeIn = cubicBezier(0.4, 0, 1, 1);
// Y overshoots slightly so the punch lands, then returns to 1.
const easePunch = cubicBezier(0.2, 1.35, 0.32, 1);

export function fnv1a(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function styleFromBrief(text: string): MotionStyle {
  const key = text.trim();
  if (!key) return "pop-in";
  return MOTION_STYLES[fnv1a(key) % MOTION_STYLES.length] ?? "pop-in";
}

export function splitWords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, MAX_WORDS);
}

function fits(
  wordCount: number,
  lead: number,
  stagger: number,
  enter: number,
  hold: number,
  durationInFrames: number,
): boolean {
  const step = wordCount <= 1 ? 0 : stagger;
  const lastStart = lead + (wordCount - 1) * step;
  const exitStart = durationInFrames - EXIT_FRAMES;
  return lastStart + enter + hold <= exitStart;
}

export function computeWordTimings(
  text: string,
  style: MotionStyle,
  durationInFrames = DURATION_IN_FRAMES,
): WordTiming[] {
  const words = splitWords(text);
  if (words.length === 0) return [];

  let lead = LEAD_FRAMES;
  let stagger = PREFERRED[style].stagger;
  let enter = PREFERRED[style].enter;
  let hold = MIN_HOLD_FRAMES;

  for (let guard = 0; guard < 200; guard++) {
    if (fits(words.length, lead, stagger, enter, hold, durationInFrames)) break;
    if (stagger > 1) stagger -= 1;
    else if (enter > 8) enter -= 1;
    else if (hold > 8) hold -= 1;
    else if (lead > 4) lead -= 1;
    else break;
  }

  const step = words.length === 1 ? 0 : stagger;
  return words.map((word, index) => ({
    word,
    index,
    startFrame: lead + index * step,
    enterFrames: enter,
  }));
}

export function clipFits(
  timings: readonly WordTiming[],
  durationInFrames = DURATION_IN_FRAMES,
  hold = MIN_HOLD_FRAMES,
): boolean {
  if (timings.length === 0) return true;
  const last = timings[timings.length - 1];
  if (!last) return true;
  return last.startFrame + last.enterFrames + hold <= durationInFrames - EXIT_FRAMES;
}

export function entranceProgress(frame: number, startFrame: number, enterFrames: number): number {
  if (enterFrames <= 0) return frame >= startFrame ? 1 : 0;
  if (frame <= startFrame) return 0;
  if (frame >= startFrame + enterFrames) return 1;
  return (frame - startFrame) / enterFrames;
}

export function exitOpacity(frame: number, durationInFrames = DURATION_IN_FRAMES): number {
  const start = durationInFrames - EXIT_FRAMES;
  if (frame <= start) return 1;
  const t = (frame - start) / Math.max(EXIT_FRAMES - 1, 1);
  return 1 - easeIn(Math.min(1, Math.max(0, t)));
}

export function exitShift(frame: number, durationInFrames = DURATION_IN_FRAMES): number {
  const start = durationInFrames - EXIT_FRAMES;
  if (frame <= start) return 0;
  const t = (frame - start) / Math.max(EXIT_FRAMES - 1, 1);
  return easeIn(Math.min(1, Math.max(0, t))) * 4;
}

export function motionAt(style: MotionStyle, linearT: number): MotionPose {
  const t = Math.min(1, Math.max(0, linearT));

  if (style === "pop-in") {
    const eased = easeOut(t);
    return {
      opacity: eased,
      x: 0,
      y: (1 - eased) * 20,
      scale: 0.96 + eased * 0.04,
    };
  }

  if (style === "slide-stagger") {
    const eased = easeOut(t);
    return {
      opacity: eased,
      x: (1 - eased) * 32,
      y: 0,
      scale: 1,
    };
  }

  const eased = easePunch(t);
  const opacity = easeOut(Math.min(1, t / 0.4));
  return {
    opacity,
    x: 0,
    y: 0,
    scale: 0.88 + eased * 0.12,
  };
}

export function stageFontSize(words: readonly string[]): number {
  const count = words.length;
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
  let size = 78;
  if (count > 5) size = 64;
  if (count > 9) size = 52;
  if (count > 14) size = 42;
  if (longest > 14) size = Math.min(size, 52);
  if (longest > 20) size = Math.min(size, 40);
  return size;
}
