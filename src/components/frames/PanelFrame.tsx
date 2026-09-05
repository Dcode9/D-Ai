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
      <path
        d={cornerArcs(1, 1, w - 2, h - 2, 10, 7)}
        fill="none"
        stroke="url(#gold-stroke)"
        strokeWidth="1"
        opacity="0.6"
      />
      {/* tiny corner dots */}
      {[
        [10, 10],
        [w - 10, 10],
        [w - 10, h - 10],
        [10, h - 10],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.2" fill="#c9a86a" opacity="0.8" />
      ))}
    </svg>
  );
}
