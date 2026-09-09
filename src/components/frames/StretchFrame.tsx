import { useId, useMemo } from "react";
import { buildClosedFramePath, type StretchShape, STRETCH_SHAPES } from "./stretchShapes";
import { cn } from "../../utils/cn";

export interface StretchFrameProps {
  shape: StretchShape | number;
  w: number;
  h: number;
  strokeWidth?: number;
  strokeColor?: string;
  activeStrokeColor?: string;
  active?: boolean;
  glow?: boolean;
  showBackdrop?: boolean;
  backdropOpacity?: number;
  className?: string;
}

export function StretchFrame({
  shape: shapeProp,
  w,
  h,
  strokeWidth = 1.6,
  strokeColor,
  activeStrokeColor,
  active = false,
  glow = false,
  showBackdrop = true,
  backdropOpacity = 0.9,
  className,
}: StretchFrameProps) {
  const reactId = useId().replace(/:/g, "");

  const shape = useMemo(() => {
    if (typeof shapeProp === "number") {
      return STRETCH_SHAPES.find((s) => s.id === shapeProp) ?? STRETCH_SHAPES[0];
    }
    return shapeProp;
  }, [shapeProp]);

  const { outerPath, innerPath } = useMemo(() => {
    if (!w || !h || w <= 0 || h <= 0) return { outerPath: "", innerPath: "" };

    // Visual bounds of the ornate frame within the shape's coordinate system
    const shapeVisualCenterY = (shape.outerTopY + shape.outerBottomY) / 2;
    const shapeVisualHeight = shape.outerBottomY - shape.outerTopY;

    // Uniform proportional scaling in both dimensions:
    // Ensures capScaleX and capScaleY scale in lockstep to preserve the 1:1 fidelity of curves and wingtips.
    const capScale = Math.min((h * 0.94) / shapeVisualHeight, (w * 0.42) / shape.capW);
    const capScaleX = capScale;
    const capScaleY = capScale;

    // Position capTop so that the visual center of the shape maps EXACTLY to h / 2
    const capTop = h / 2 - shapeVisualCenterY * capScaleY;

    const outer = buildClosedFramePath(shape.outer, shape.capW, w, capScaleX, capTop, capScaleY);
    const inner = buildClosedFramePath(shape.inner, shape.capW, w, capScaleX, capTop, capScaleY);

    return { outerPath: outer, innerPath: inner };
  }, [shape, w, h]);

  if (!w || !h || w <= 0 || h <= 0 || !outerPath) return null;

  const effectiveOuterStroke = active
    ? activeStrokeColor ?? "url(#gold-stroke-bright)"
    : strokeColor ?? "url(#gold-stroke)";

  const isWide = w > 300; // Wide container (Message Box) vs standard button

  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 overflow-visible transition-[filter,opacity] duration-500",
        active || glow ? "drop-shadow-[0_0_14px_rgba(201,168,106,0.45)]" : undefined,
        className,
      )}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      <defs>
        {/* Exact clipping contour matching the inner boundary for the interior fill */}
        <clipPath id={`inner-clip-${reactId}`}>
          <path d={innerPath || outerPath} />
        </clipPath>
        {/* Outer clipping contour for the obsidian base plate */}
        <clipPath id={`outer-clip-${reactId}`}>
          <path d={outerPath} />
        </clipPath>
      </defs>

      {/* BACK COLORED CONTAINER AREA: 100% boundary-clipped to the exact ornate contour with plum/amber soul */}
      {showBackdrop && (
        <>
          {/* Base velvety obsidian plate behind the entire frame */}
          <g clipPath={`url(#outer-clip-${reactId})`}>
            <rect width={w} height={h} fill="#161514" opacity={backdropOpacity} />
          </g>

          {/* Inner luminous gradient fill strictly clipped to the inner ornate silhouette */}
          <g clipPath={`url(#inner-clip-${reactId})`}>
            <rect width={w} height={h} fill="#161514" opacity={isWide ? 0.92 : 0.85} />

            {!isWide ? (
              /* Button Fill: Exact match of the original normal SVGs (rich, saturated, high-contrast corner pools) */
              <>
                <ellipse
                  cx={w * 0.3}
                  cy={h * 0.15}
                  rx={w * 0.34}
                  ry={h * 0.5}
                  fill="#6b3fa0"
                  filter="url(#blur-12)"
                  className="transition-opacity duration-700"
                  opacity={active ? 0.85 : 0.55}
                />
                <ellipse
                  cx={w * 0.8}
                  cy={h * 0.95}
                  rx={w * 0.3}
                  ry={h * 0.45}
                  fill="#c9a04a"
                  filter="url(#blur-12)"
                  className="transition-opacity duration-700"
                  opacity={active ? 0.75 : 0.42}
                />
              </>
            ) : (
              /* Message Box Fill: Triple ambient glowing pools (plum on left, warm amber in center, amethyst on right) */
              <>
                <ellipse
                  cx={w * 0.22}
                  cy={h * 0.85}
                  rx={w * 0.2}
                  ry={h * 0.7}
                  fill="#6b3fa0"
                  filter="url(#blur-24)"
                  className="transition-opacity duration-700"
                  opacity={glow || active ? 0.8 : 0.58}
                />
                <ellipse
                  cx={w * 0.55}
                  cy={h * 1.05}
                  rx={w * 0.14}
                  ry={h * 0.55}
                  fill="#c9a04a"
                  filter="url(#blur-24)"
                  className="transition-opacity duration-700"
                  opacity={glow || active ? 0.7 : 0.46}
                />
                <ellipse
                  cx={w * 0.9}
                  cy={h * 0.1}
                  rx={w * 0.12}
                  ry={h * 0.5}
                  fill="#7a49b8"
                  filter="url(#blur-24)"
                  className="transition-opacity duration-700"
                  opacity={glow || active ? 0.65 : 0.4}
                />
              </>
            )}

            {/* Fine noise grain overlay for authentic animated grainy texture */}
            <rect
              width={w}
              height={h}
              fill="url(#grain-pattern)"
              style={{ mixBlendMode: "overlay" }}
              opacity={0.35}
            />
          </g>
        </>
      )}

      {/* CONTINUOUS OUTER ORNATE FRAME: 0 gaps, 0 disconnections */}
      <path
        d={outerPath}
        fill="none"
        stroke={effectiveOuterStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        shapeRendering="geometricPrecision"
        opacity={active ? 1 : 0.92}
      />

      {/* CONTINUOUS INNER ORNATE FRAME: bright gilded highlight */}
      {innerPath && (
        <path
          d={innerPath}
          fill="none"
          stroke={active ? "url(#gold-stroke-bright)" : "url(#gold-stroke-bright)"}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
          opacity={active ? 0.95 : 0.75}
        />
      )}
    </svg>
  );
}
