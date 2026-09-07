import { MODES, type Mode } from "../hooks/useChat";
import { useSize } from "../hooks/useSize";
import { StretchFrame } from "./frames/StretchFrame";
import { cn } from "../utils/cn";

// Assign distinct stretchable SVG shapes (1 through 5) from the user's collection to the 5 disciplines
const MODE_SHAPE_MAP: Record<Mode, number> = {
  Image: 1, // Shape 1: Stepped architectural bracket with central diamond beak
  Video: 2, // Shape 2: Scalloped baroque crest with double notches
  Code: 3,  // Shape 3: Geometric angular chevron profile
  Text: 4,  // Shape 4: Royal cartouche with stepped ears and diamond tip
  Music: 5, // Shape 5: Flowing scrollwork with scalloped wings
};

interface DisciplineButtonProps {
  mode: Mode;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  delay?: number;
}

function DisciplineButton({ mode, active, onClick, compact, delay = 0 }: DisciplineButtonProps) {
  const { ref, w, h } = useSize<HTMLButtonElement>();
  const shapeId = MODE_SHAPE_MAP[mode];

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "group relative isolate flex cursor-pointer select-none items-center justify-center outline-none rise transition-transform duration-300",
        "hover:-translate-y-1 focus-visible:-translate-y-1 active:scale-95",
        compact ? "h-[64px] w-[112px]" : "h-[104px] w-[158px]",
      )}
      aria-pressed={active}
      title={`${mode} discipline`}
    >
      <StretchFrame
        shape={shapeId}
        w={w}
        h={h}
        active={active}
        glow={active}
        strokeWidth={active ? 1.8 : 1.5}
        showBackdrop={true}
        backdropOpacity={0.88}
        className="transition-all duration-300"
      />

      <span
        className={cn(
          "relative z-10 block font-display text-[30px] leading-none tracking-wide transition-colors duration-300 select-none",
          compact ? "text-[20px]" : "text-[30px]",
          active ? "text-[#fff3d6]" : "text-cream group-hover:text-[#fff3d6]",
        )}
        style={{ textShadow: "0 1px 0 rgba(0,0,0,.6), 0 0 14px rgba(239,227,198,.25)" }}
      >
        {mode}
      </span>
    </button>
  );
}

type Props = {
  mode: Mode | null;
  onSelect: (m: Mode | null) => void;
  compact?: boolean;
};

export function ModeButtons({ mode, onSelect, compact }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center",
        compact ? "gap-2.5" : "gap-5 md:gap-7 max-w-4xl mx-auto",
      )}
    >
      {MODES.map((m, i) => (
        <DisciplineButton
          key={m}
          mode={m}
          active={mode === m}
          onClick={() => onSelect(mode === m ? null : m)}
          compact={compact}
          delay={i * 70}
        />
      ))}
    </div>
  );
}
