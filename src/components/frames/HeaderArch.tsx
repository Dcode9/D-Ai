type Props = { w: number; h: number };

/**
 * The header rule that swells up into a dome around the title.
 * Dome geometry is fixed in pixels; the flat rule stretches.
 */
export function HeaderArch({ w, h }: Props) {
  if (!w) return null;
  const y = h - 6; // baseline of the rule
  const cx = w / 2;
  const top = 22; // dome apex
  const half = Math.min(250, w * 0.28); // half-width where the dome starts
  const flat = Math.min(80, w * 0.08); // flat top of the dome

  const d = [
    `M0,${y}`,
    `H${cx - half}`,
    `C${cx - half * 0.45},${y} ${cx - flat - 60},${top} ${cx - flat},${top}`,
    `H${cx + flat}`,
    `C${cx + flat + 60},${top} ${cx + half * 0.45},${y} ${cx + half},${y}`,
    `H${w}`,
  ].join(" ");

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <path d={d} fill="none" stroke="url(#gold-stroke)" strokeWidth="1" opacity="0.85" />
      {/* soft light under the dome */}
      <ellipse cx={cx} cy={y} rx={half * 0.8} ry={40} fill="#c9a04a" opacity="0.06" filter="url(#blur-24)" />
    </svg>
  );
}
