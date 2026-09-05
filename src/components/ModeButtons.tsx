import { MODES, type Mode } from "../hooks/useChat";
import { OrnateFrame, type FrameVariant } from "./frames/OrnateFrame";

const VARIANT: Record<Mode, FrameVariant> = {
  Image: "image",
  Video: "video",
  Code: "code",
  Text: "text",
  Music: "music",
};

type Props = { mode: Mode | null; onSelect: (m: Mode | null) => void; compact?: boolean };

export function ModeButtons({ mode, onSelect, compact }: Props) {
  return (
    <div className={compact ? "flex flex-wrap items-center justify-center gap-3" : "flex flex-wrap items-center justify-center gap-5 md:gap-9"}>
      {MODES.map((m, i) => (
        <OrnateFrame
          key={m}
          variant={VARIANT[m]}
          active={mode === m}
          onClick={() => onSelect(mode === m ? null : m)}
          className={compact ? "h-[64px] w-[112px] rise" : "h-[104px] w-[158px] rise"}
        >
          <span style={{ animationDelay: `${i * 70}ms` }} className={compact ? "text-[19px]" : ""}>
            {m}
          </span>
        </OrnateFrame>
      ))}
    </div>
  );
}
