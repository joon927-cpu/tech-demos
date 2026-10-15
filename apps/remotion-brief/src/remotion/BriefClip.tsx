import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  DURATION_IN_FRAMES,
  entranceProgress,
  exitOpacity,
  exitShift,
  motionAt,
  splitWords,
  stageFontSize,
  computeWordTimings,
  type MotionStyle,
} from "@/lib/motion";

export type BriefClipProps = {
  text: string;
  motion: MotionStyle;
  reducedMotion: boolean;
};

const STAGE = "#111111";
const INK = "#f4f4f5";
const HINT = "rgba(244, 244, 245, 0.42)";

export function BriefClip({ text, motion, reducedMotion }: BriefClipProps) {
  const frame = useCurrentFrame();
  const words = splitWords(text);
  const timings = computeWordTimings(text, motion);
  const fontSize = stageFontSize(words.length > 0 ? words : ["Type"]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: STAGE,
        alignItems: "center",
        justifyContent: "center",
        padding: "9%",
        overflow: "hidden",
      }}
    >
      {words.length === 0 ? (
        <div
          style={{
            color: HINT,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 42,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          Type a one-line brief
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            width: "100%",
            columnGap: fontSize * 0.28,
            rowGap: fontSize * 0.16,
          }}
        >
          {timings.map((timing) => {
            const pose = reducedMotion
              ? { opacity: 1, x: 0, y: 0, scale: 1 }
              : motionAt(
                  motion,
                  entranceProgress(frame, timing.startFrame, timing.enterFrames),
                );
            const opacity = reducedMotion ? 1 : pose.opacity * exitOpacity(frame, DURATION_IN_FRAMES);
            const y = reducedMotion ? 0 : pose.y + exitShift(frame, DURATION_IN_FRAMES);

            return (
              <span
                key={timing.index}
                style={{
                  display: "inline-block",
                  color: INK,
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize,
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  opacity,
                  transform: `translate3d(${pose.x}px, ${y}px, 0) scale(${pose.scale})`,
                  transformOrigin: motion === "slide-stagger" ? "center center" : "50% 100%",
                  willChange: "transform, opacity",
                }}
              >
                {timing.word}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
}
