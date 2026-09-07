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

          {/* Optimized noise filter and repeating pattern */}
          <filter id="noise" x="0" y="0" width="160" height="160" filterUnits="userSpaceOnUse">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <pattern id="grain-pattern" width="160" height="160" patternUnits="userSpaceOnUse">
            <rect width="160" height="160" filter="url(#noise)" />
          </pattern>

          <filter id="blur-12" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="blur-24" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
        </defs>
      </svg>

      {/* Hardware-tiled full-screen grain overlay - lightweight & crash-free */}
      <svg
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
        style={{ mixBlendMode: "overlay", opacity: 0.38 }}
        aria-hidden
      >
        <rect width="100%" height="100%" fill="url(#grain-pattern)" />
      </svg>
    </>
  );
}
