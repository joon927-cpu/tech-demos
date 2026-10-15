import { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { BriefClip } from "@/remotion/BriefClip";
import {
  DURATION_IN_FRAMES,
  FPS,
  MOTION_STYLES,
  STYLE_LABEL,
  styleFromBrief,
  type MotionStyle,
} from "@/lib/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type StyleChoice = "auto" | MotionStyle;

const CHOICES: { value: StyleChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "pop-in", label: "Pop" },
  { value: "slide-stagger", label: "Slide" },
  { value: "scale-punch", label: "Punch" },
];

function isStyleChoice(value: string): value is StyleChoice {
  return value === "auto" || MOTION_STYLES.some((style) => style === value);
}

export default function App() {
  const playerRef = useRef<PlayerRef>(null);
  const [text, setText] = useState("Launch the quiet version.");
  const [choice, setChoice] = useState<StyleChoice>("auto");
  const [reducedMotion, setReducedMotion] = useState(false);

  const motion = choice === "auto" ? styleFromBrief(text) : choice;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const player = playerRef.current;
      if (!player) return;
      player.seekTo(0);
      player.play();
    });
    return () => cancelAnimationFrame(frame);
  }, [text, motion]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-lg font-medium tracking-tight">Remotion Brief</h1>
        <p className="text-muted-foreground max-w-prose text-xs leading-relaxed">
          Type one line. A four-second clip plays the words back.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brief">Brief</Label>
          <Input
            id="brief"
            value={text}
            maxLength={140}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Type a one-line brief"
            className="h-10 px-3 text-sm"
            onChange={(event) => setText(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label id="motion-label">Motion</Label>
            <p className="text-muted-foreground text-[11px] tracking-wide" aria-live="polite">
              {choice === "auto" ? "Auto" : "Override"} · {STYLE_LABEL[motion]}
            </p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={choice}
            aria-labelledby="motion-label"
            className="flex-wrap"
            onValueChange={(value) => {
              if (isStyleChoice(value)) setChoice(value);
            }}
          >
            {CHOICES.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value} className="px-3">
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <Player
            ref={playerRef}
            component={BriefClip}
            inputProps={{ text, motion, reducedMotion }}
            durationInFrames={DURATION_IN_FRAMES}
            compositionWidth={1280}
            compositionHeight={720}
            fps={FPS}
            loop
            autoPlay
            initiallyMuted
            numberOfSharedAudioTags={0}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            showVolumeControls={false}
            acknowledgeRemotionLicense
            style={{ width: "100%", backgroundColor: "#111111" }}
          />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-[11px] tracking-wide">4s loop</p>
    </main>
  );
}
