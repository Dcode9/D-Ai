/**
 * Global SVG definitions referenced by id across all the frame SVGs.
 * Uses a hardware-tiled pattern for noise grain to ensure 0% GPU spikes
 * and eliminate random browser out-of-memory crashes.
 */
export function SvgDefs() {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <linearGradient id="gold-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8d3a0" />
            <stop offset="45%" stopColor="#c9a86a" />
            <stop offset="100%" stopColor="#a8894f" />
          </linearGradient>
          <linearGradient id="gold-stroke-bright" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff2cf" />
            <stop offset="50%" stopColor="#e8d3a0" />
            <stop offset="100%" stopColor="#c9a86a" />
          </linearGradient>

          {/* Mezzotint grain blur (from d-ui): scatter 55, density .70, diffusion 8.5, octaves 1 */}
          <filter id="dai-mezz" x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.675" result="diffused" />
            <feTurbulence type="fractalNoise" baseFrequency="0.875" numOctaves="1" stitchTiles="stitch" result="inkGrain" />
            <feDisplacementMap in="diffused" in2="inkGrain" scale="35.75" xChannelSelector="R" yChannelSelector="G" result="jittered" />
          </filter>

          {/* Optimized noise filter and repeating pattern */}
          <pattern id="grain-pattern" width="128" height="128" patternUnits="userSpaceOnUse">
            <image href="/grain.png" width="128" height="128" />
          </pattern>
          <radialGradient id="glow-plum"><stop offset="0%" stopColor="#6b3fa0" stopOpacity="1" /><stop offset="100%" stopColor="#6b3fa0" stopOpacity="0" /></radialGradient>
          <radialGradient id="glow-amber"><stop offset="0%" stopColor="#c9a04a" stopOpacity="1" /><stop offset="100%" stopColor="#c9a04a" stopOpacity="0" /></radialGradient>
          <radialGradient id="glow-amethyst"><stop offset="0%" stopColor="#7a49b8" stopOpacity="1" /><stop offset="100%" stopColor="#7a49b8" stopOpacity="0" /></radialGradient>
        </defs>
      </svg>

    </>
  );
}
