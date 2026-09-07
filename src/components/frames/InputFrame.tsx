import { StretchFrame } from "./StretchFrame";
import { STRETCH_SHAPES, type StretchShape } from "./stretchShapes";
import type { Mode } from "../../hooks/useChat";

type Props = {
  w: number;
  h: number;
  focused?: boolean;
  busy?: boolean;
  mode?: Mode | null;
  shapeId?: number;
};

export const INPUT_CAP = 78; // horizontal padding for ornate end caps
export const INPUT_DIAMOND = 14; // vertical padding

// Mapping of discipline modes to distinct shapes, defaulting to Shape 8 for general chat
export const MODE_SHAPES: Record<Mode, number> = {
  Image: 1,
  Video: 2,
  Code: 3,
  Text: 4,
  Music: 5,
};

export function InputFrame({ w, h, focused, busy, mode, shapeId }: Props) {
  if (!w || !h || w <= 0 || h <= 0) return null;

  // Selected discipline shape or default Shape 8 (heraldic banner frame)
  const activeShapeId = shapeId ?? (mode ? MODE_SHAPES[mode] : 8);
  const shape: StretchShape =
    STRETCH_SHAPES.find((s) => s.id === activeShapeId) ?? STRETCH_SHAPES[7]; // Shape 8 is index 7

  return (
    <StretchFrame
      shape={shape}
      w={w}
      h={h}
      strokeWidth={focused ? 1.8 : 1.5}
      active={focused}
      glow={focused || busy}
      showBackdrop={true}
      backdropOpacity={0.92}
      className="transition-all duration-300"
    />
  );
}
