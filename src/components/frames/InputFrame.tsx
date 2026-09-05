import { useId } from "react";
import { diamond, notchRect } from "./paths";

type Props = { w: number; h: number; focused?: boolean; busy?: boolean };

export const INPUT_CAP = 40; // horizontal room reserved for each chevron cap
export const INPUT_DIAMOND = 15; // half-diagonal of the top/bottom diamonds

/**
 * Banner-style input frame: double-lined box, chevron end-caps with an
 * inner bracket, and lozenge medallions breaking the top & bottom rules.
 */
export function InputFrame({ w, h, focused, busy }: Props) {
  const id = useId().replace(/:/g, "");
  if (!w || !h) return null;

  const d = INPUT_DIAMOND;
  const cap = INPUT_CAP;
  const x0 = cap;
  const x1 = w - cap;
  const y0 = d;
  const y1 = h - d;
  const cy = h / 2;
  const cx = w / 2;
  const ext = 10;

  const outline = [
    `M${x0},${y0}`,
    `H${x1}`,
    `L${x1 + ext},${y0}`,
    `L${w - 1},${cy}`,
    `L${x1 + ext},${y1}`,
    `H${x0}`,
    `L${x0 - ext},${y1}`,
    `L${1},${cy}`,
    `L${x0 - ext},${y0}`,
    "Z",
  ].join(" ");

  const boxSides = `M${x0},${y0} V${y1} M${x1},${y0} V${y1}`;

  const innerBracketL = `M${x0 - 3},${y0 + 9} L${x0 - ext - 8},${cy} L${x0 - 3},${y1 - 9}`;
  const innerBracketR = `M${x1 + 3},${y0 + 9} L${x1 + ext + 8},${cy} L${x1 + 3},${y1 - 9}`;

  const inner = notchRect(x0 + 7, y0 + 7, x1 - x0 - 14, y1 - y0 - 14, 6);

  const stroke = focused ? "url(#gold-stroke-bright)" : "url(#gold-stroke)";

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible transition-[filter] duration-500"
      style={{ filter: focused ? "drop-shadow(0 0 8px rgba(201,168,106,.35))" : undefined }}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <defs>
        <clipPath id={`inclip-${id}`}>
          <path d={outline} />
        </clipPath>
      </defs>

      {/* plate + grainy gradient */}
      <g clipPath={`url(#inclip-${id})`}>
        <rect width={w} height={h} fill="#181716" opacity="0.92" />
        <ellipse
          cx={w * 0.22}
          cy={h * 0.85}
          rx={w * 0.2}
          ry={h * 0.7}
          fill="#6b3fa0"
          filter="url(#blur-24)"
          opacity={busy ? 0.75 : 0.5}
          className="transition-opacity duration-700"
        />
        <ellipse
          cx={w * 0.55}
          cy={h * 1.05}
          rx={w * 0.14}
          ry={h * 0.55}
          fill="#c9a04a"
          filter="url(#blur-24)"
          opacity={busy ? 0.6 : 0.4}
          className="transition-opacity duration-700"
        />
        <ellipse
          cx={w * 0.9}
          cy={h * 0.1}
          rx={w * 0.12}
          ry={h * 0.5}
          fill="#7a49b8"
          filter="url(#blur-24)"
          opacity={busy ? 0.55 : 0.3}
          className="transition-opacity duration-700"
        />
        <rect width={w} height={h} filter="url(#noise)" style={{ mixBlendMode: "overlay" }} opacity="0.4" />
      </g>

      {/* outline + inner details */}
      <path d={outline} fill="none" stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
      <path d={boxSides} fill="none" stroke={stroke} strokeWidth="1" opacity="0.8" />
      <path d={innerBracketL} fill="none" stroke={stroke} strokeWidth="1" strokeLinejoin="round" opacity="0.8" />
      <path d={innerBracketR} fill="none" stroke={stroke} strokeWidth="1" strokeLinejoin="round" opacity="0.8" />
      <path d={inner} fill="none" stroke={stroke} strokeWidth="1" opacity="0.55" />

      {/* tip jewels */}
      <path d={diamond(13, cy, 3.5)} fill="#e8d3a0" opacity="0.9" />
      <path d={diamond(w - 13, cy, 3.5)} fill="#e8d3a0" opacity="0.9" />

      {/* top & bottom medallions */}
      {[y0, y1].map((yy, i) => (
        <g key={i}>
          <path d={diamond(cx, yy, d)} fill="#1c1b1a" stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
          <path d={diamond(cx, yy, d * 0.6)} fill="none" stroke={stroke} strokeWidth="1" opacity="0.8" />
          <path d={diamond(cx, yy, d * 0.25)} fill="#c9a86a" opacity="0.9" />
          {/* flanking ticks */}
          <path
            d={`M${cx - d - 12},${yy} H${cx - d - 3} M${cx + d + 3},${yy} H${cx + d + 12}`}
            stroke={stroke}
            strokeWidth="1"
            opacity="0.6"
          />
        </g>
      ))}
    </svg>
  );
}
