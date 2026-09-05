/**
 * Parametric ornamental path generators.
 *
 * Every shape is built from live pixel dimensions, so ornament sizes
 * (corner notches, scallops, ears, arches) stay constant while the
 * straight runs stretch. This is a "9-slice for vector paths".
 */

const f = (n: number) => Math.round(n * 100) / 100;

/** Plain rectangle */
export const rect = (x: number, y: number, w: number, h: number) =>
  `M${f(x)},${f(y)} H${f(x + w)} V${f(y + h)} H${f(x)} Z`;

/** Rounded rectangle (convex corners) */
export const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return [
    `M${f(x + r)},${f(y)}`,
    `H${f(x + w - r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}`,
    `V${f(y + h - r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}`,
    `H${f(x + r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)}`,
    `V${f(y + r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}`,
    "Z",
  ].join(" ");
};

/** Rectangle with concave (scooped) quarter-circle corners */
export const scoopRect = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return [
    `M${f(x + r)},${f(y)}`,
    `H${f(x + w - r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(x + w)},${f(y + r)}`,
    `V${f(y + h - r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(x + w - r)},${f(y + h)}`,
    `H${f(x + r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(x)},${f(y + h - r)}`,
    `V${f(y + r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(x + r)},${f(y)}`,
    "Z",
  ].join(" ");
};

/** Rectangle with square notches cut into each corner */
export const notchRect = (x: number, y: number, w: number, h: number, s: number) =>
  [
    `M${f(x + s)},${f(y)}`,
    `H${f(x + w - s)}`,
    `V${f(y + s)}`,
    `H${f(x + w)}`,
    `V${f(y + h - s)}`,
    `H${f(x + w - s)}`,
    `V${f(y + h)}`,
    `H${f(x + s)}`,
    `V${f(y + h - s)}`,
    `H${f(x)}`,
    `V${f(y + s)}`,
    `H${f(x + s)}`,
    "Z",
  ].join(" ");

/** Rectangle with chamfered (45°) corners */
export const chamferRect = (x: number, y: number, w: number, h: number, c: number) =>
  [
    `M${f(x + c)},${f(y)}`,
    `H${f(x + w - c)}`,
    `L${f(x + w)},${f(y + c)}`,
    `V${f(y + h - c)}`,
    `L${f(x + w - c)},${f(y + h)}`,
    `H${f(x + c)}`,
    `L${f(x)},${f(y + h - c)}`,
    `V${f(y + c)}`,
    "Z",
  ].join(" ");

/**
 * Cloud / scalloped rectangle.
 * `lobes` shallow convex bumps along top/bottom, one bump on each side,
 * rounded convex corners of radius r.
 */
export const cloudRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  lobes = 3,
  bulge = 1.25,
) => {
  const top = w - 2 * r;
  const seg = top / lobes;
  const R = (seg / 2) * bulge;
  const sideLen = h - 2 * r;
  const Rs = (sideLen / 2) * bulge;

  const parts: string[] = [`M${f(x + r)},${f(y)}`];
  // top, left → right
  for (let i = 1; i <= lobes; i++) parts.push(`A${f(R)},${f(R)} 0 0 1 ${f(x + r + seg * i)},${f(y)}`);
  parts.push(`A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}`);
  // right side
  parts.push(`A${f(Rs)},${f(Rs)} 0 0 1 ${f(x + w)},${f(y + h - r)}`);
  parts.push(`A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}`);
  // bottom, right → left
  for (let i = 1; i <= lobes; i++) parts.push(`A${f(R)},${f(R)} 0 0 1 ${f(x + w - r - seg * i)},${f(y + h)}`);
  parts.push(`A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)}`);
  // left side
  parts.push(`A${f(Rs)},${f(Rs)} 0 0 1 ${f(x)},${f(y + r)}`);
  parts.push(`A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}`);
  parts.push("Z");
  return parts.join(" ");
};

/**
 * Ogee (Moorish) arch plaque – a flat-bottomed shape whose top rises in
 * an S-curve from each shoulder to a pointed central peak.
 * `notch` cuts small square notches into the two bottom corners.
 */
export const ogeeArch = (x: number, y: number, w: number, h: number, archH: number, notch = 0) => {
  const cx = x + w / 2;
  const sy = y + archH; // shoulder height
  const n = notch;
  const left = [
    `M${f(x + n)},${f(y + h)}`,
    n ? `V${f(y + h - n)} H${f(x)}` : "",
    `V${f(sy)}`,
    // shoulder → peak (ogee: convex then concave)
    `C${f(x)},${f(y + archH * 0.15)} ${f(cx - w * 0.14)},${f(y + archH * 0.62)} ${f(cx)},${f(y)}`,
    `C${f(cx + w * 0.14)},${f(y + archH * 0.62)} ${f(x + w)},${f(y + archH * 0.15)} ${f(x + w)},${f(sy)}`,
    `V${f(y + h - n)}`,
    n ? `H${f(x + w - n)} V${f(y + h)}` : "",
    "Z",
  ];
  return left.filter(Boolean).join(" ");
};

/**
 * Baroque cartouche: a rectangle whose corners flare out into small
 * "ears" of extent `c` and depth `t`, joined by concave scoops.
 */
export const cartouche = (x: number, y: number, w: number, h: number, c: number, t: number) => {
  const X = x + w;
  const Y = y + h;
  const a = (to: string) => `A${f(t)},${f(t)} 0 0 0 ${to}`; // concave scoop
  const v = (to: string) => `A${f(t)},${f(t)} 0 0 1 ${to}`; // convex corner
  return [
    `M${f(x + c)},${f(y + t)}`,
    `H${f(X - c)}`,
    a(`${f(X - c + t)},${f(y)}`),
    `H${f(X - t)}`,
    v(`${f(X)},${f(y + t)}`),
    `V${f(y + c - t)}`,
    a(`${f(X - t)},${f(y + c)}`),
    `V${f(Y - c)}`,
    a(`${f(X)},${f(Y - c + t)}`),
    `V${f(Y - t)}`,
    v(`${f(X - t)},${f(Y)}`),
    `H${f(X - c + t)}`,
    a(`${f(X - c)},${f(Y - t)}`),
    `H${f(x + c)}`,
    a(`${f(x + c - t)},${f(Y)}`),
    `H${f(x + t)}`,
    v(`${f(x)},${f(Y - t)}`),
    `V${f(Y - c + t)}`,
    a(`${f(x + t)},${f(Y - c)}`),
    `V${f(y + c)}`,
    a(`${f(x)},${f(y + c - t)}`),
    `V${f(y + t)}`,
    v(`${f(x + t)},${f(y)}`),
    `H${f(x + c - t)}`,
    a(`${f(x + c)},${f(y + t)}`),
    "Z",
  ].join(" ");
};

/**
 * Scooped rectangle with a soft "brace" bump rising from the middle of
 * the top and bottom edges. The bump extends `b` px beyond the box.
 */
export const braceRect = (x: number, y: number, w: number, h: number, r: number, b: number, bw = 26) => {
  const cx = x + w / 2;
  const X = x + w;
  const Y = y + h;
  const bump = (yEdge: number, dir: 1 | -1, from: number, to: number) => {
    // dir -1 = bump upward (top edge), 1 = bump downward
    const peak = yEdge + dir * b;
    const mid = (from + to) / 2;
    const sgn = to > from ? 1 : -1;
    return [
      `L${f(from)},${f(yEdge)}`,
      `C${f(from + sgn * bw * 0.35)},${f(yEdge)} ${f(mid - sgn * bw * 0.3)},${f(peak)} ${f(mid)},${f(peak)}`,
      `C${f(mid + sgn * bw * 0.3)},${f(peak)} ${f(to - sgn * bw * 0.35)},${f(yEdge)} ${f(to)},${f(yEdge)}`,
    ].join(" ");
  };
  return [
    `M${f(x + r)},${f(y)}`,
    bump(y, -1, cx - bw, cx + bw),
    `H${f(X - r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(X)},${f(y + r)}`,
    `V${f(Y - r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(X - r)},${f(Y)}`,
    bump(Y, 1, cx + bw, cx - bw),
    `H${f(x + r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(x)},${f(Y - r)}`,
    `V${f(y + r)}`,
    `A${f(r)},${f(r)} 0 0 0 ${f(x + r)},${f(y)}`,
    "Z",
  ].join(" ");
};

/** Diamond centred on (cx, cy) with half-diagonal d */
export const diamond = (cx: number, cy: number, d: number) =>
  `M${f(cx)},${f(cy - d)} L${f(cx + d)},${f(cy)} L${f(cx)},${f(cy + d)} L${f(cx - d)},${f(cy)} Z`;

/** Small "L" corner ticks placed just inside a rectangle's corners */
export const cornerTicks = (x: number, y: number, w: number, h: number, len: number, inset = 0) => {
  const X = x + w;
  const Y = y + h;
  return [
    `M${f(x + inset)},${f(y + inset + len)} V${f(y + inset)} H${f(x + inset + len)}`,
    `M${f(X - inset - len)},${f(y + inset)} H${f(X - inset)} V${f(y + inset + len)}`,
    `M${f(X - inset)},${f(Y - inset - len)} V${f(Y - inset)} H${f(X - inset - len)}`,
    `M${f(x + inset + len)},${f(Y - inset)} H${f(x + inset)} V${f(Y - inset - len)}`,
  ].join(" ");
};

/** Small quarter-arc flourishes inside each corner of a rectangle */
export const cornerArcs = (x: number, y: number, w: number, h: number, r: number, inset: number) => {
  const X = x + w;
  const Y = y + h;
  const i = inset;
  return [
    `M${f(x + i)},${f(y + i + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + i + r)},${f(y + i)}`,
    `M${f(X - i - r)},${f(y + i)} A${f(r)},${f(r)} 0 0 1 ${f(X - i)},${f(y + i + r)}`,
    `M${f(X - i)},${f(Y - i - r)} A${f(r)},${f(r)} 0 0 1 ${f(X - i - r)},${f(Y - i)}`,
    `M${f(x + i + r)},${f(Y - i)} A${f(r)},${f(r)} 0 0 1 ${f(x + i)},${f(Y - i - r)}`,
  ].join(" ");
};
