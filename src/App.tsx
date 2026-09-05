import { Ambient } from "./components/Ambient";
import { SvgDefs } from "./components/SvgDefs";

export default function App() {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-ink text-cream select-none">
      <SvgDefs />
      <Ambient state="idle" visible={true} />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-gold/35 bg-black/40 px-5 py-1.5 shadow-[0_0_24px_rgba(201,168,106,0.18)] backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-2 shadow-[0_0_8px_rgba(232,211,160,0.9)] animate-pulse" />
          <span className="font-body text-xs md:text-sm uppercase tracking-[0.3em] text-[#fff2cf]">
            Coming Soon
          </span>
        </div>

        <h1 className="title-glow font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl italic tracking-wide text-cream font-normal leading-tight">
          An Ornate Intelligence
        </h1>

        <p className="mt-4 font-body text-xs md:text-sm tracking-[0.25em] uppercase text-gold/60">
          ai.d-verse.in
        </p>
      </div>
    </div>
  );
}

