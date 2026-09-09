import { cornerArcs, roundRect } from "./paths";

type Props = { w: number; h: number };

/** Large rounded panel border with quarter-arc flourishes in each corner. */
export function PanelFrame({ w, h }: Props) {
  if (!w || !h) return null;
  const R = 16;
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <path d={roundRect(1, 1, w - 2, h - 2, R)} fill="none" stroke="url(#gold-stroke)" strokeWidth="1" opacity="0.9" />
    </svg>
  );
}
