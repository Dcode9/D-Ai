import { StretchFrame } from "./StretchFrame";
import { STRETCH_SHAPES, type StretchShape } from "./stretchShapes";
import type { Mode } from "../../hooks/useChat";

type Props = {
  w: number;
  h: number;
  focused?: boolean;
  busy?: boolean;
  mode?: Mode | null;
};

export const INPUT_CAP = 78;
export const INPUT_DIAMOND = 14;

// The message box ALWAYS uses the same SVG (Shape 8: the heraldic banner container) regardless of mode
const MESSAGE_BOX_SHAPE: StretchShape =
  STRETCH_SHAPES.find((s) => s.id === 8) ?? STRETCH_SHAPES[7];

export function InputFrame({ w, h, focused, busy }: Props) {
  if (!w || !h || w <= 0 || h <= 0) return null;

  return (
    <StretchFrame
      shape={MESSAGE_BOX_SHAPE}
      w={w}
      h={h}
      strokeWidth={focused ? 1.8 : 1.5}
      active={focused}
      glow={focused || busy}
      showBackdrop={true}
      backdropOpacity={0.94}
      className="transition-all duration-300"
    />
  );
}
