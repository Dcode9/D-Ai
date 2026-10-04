import type { ReactNode } from "react";

type Item = Record<string, any>;
export type GenSpec =
  | { type: "stats"; title?: string; items: { label: string; value: string | number; note?: string }[] }
  | { type: "table"; title?: string; columns: string[]; rows: (string | number)[][] }
  | { type: "steps"; title?: string; items: { title: string; body?: string }[] }
  | { type: "timeline"; title?: string; items: { when: string; title: string; body?: string }[] }
  | { type: "compare"; title?: string; options: { name: string; pros?: string[]; cons?: string[] }[] }
  | { type: "chart"; title?: string; unit?: string; bars: { label: string; value: number }[] }
  | { type: "callout"; title?: string; body: string; tone?: "info" | "warn" | "tip" };

const s = (v: unknown) => (v == null ? "" : String(v));

function Shell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="gen-ui ornate-card decode-in my-4 rounded-sm border border-gold/40 bg-black/45 shadow-[0_6px_26px_rgba(0,0,0,.35)]">
      {title && <div className="border-b border-gold/20 bg-gold/[0.05] px-4 py-2 font-display text-[13px] uppercase tracking-[0.16em] text-gold-2/90">{s(title)}</div>}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function parseGenSpec(raw: string): GenSpec | null {
  try {
    const j = JSON.parse(raw) as Item;
    return j && typeof j.type === "string" ? (j as GenSpec) : null;
  } catch {
    return null;
  }
}

export function GenUI({ spec }: { spec: GenSpec }) {
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  switch (spec.type) {
    case "stats":
      return (
        <Shell title={spec.title}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {arr<Item>(spec.items).map((it, i) => (
              <div key={i} className="rounded-sm border border-gold/25 bg-black/40 px-3 py-2.5">
                <div className="font-display text-[26px] leading-none text-cream">{s(it.value)}</div>
                <div className="mt-1 font-body text-[12px] uppercase tracking-[0.12em] text-gold/80">{s(it.label)}</div>
                {it.note && <div className="mt-1 font-body text-[12.5px] text-muted">{s(it.note)}</div>}
              </div>
            ))}
          </div>
        </Shell>
      );
    case "table":
      return (
        <Shell title={spec.title}>
          <div className="scroll-gold overflow-x-auto">
            <table className="w-full border-collapse text-left font-body text-[14px]">
              <thead>
                <tr>{arr<string>(spec.columns).map((c, i) => <th key={i} className="border-b border-gold/30 px-3 py-2 font-display text-[12px] uppercase tracking-[0.12em] text-gold-2">{s(c)}</th>)}</tr>
              </thead>
              <tbody>
                {arr<unknown[]>(spec.rows).map((r, i) => (
                  <tr key={i} className="odd:bg-gold/[0.03]">{arr<unknown>(r).map((c, j) => <td key={j} className="border-b border-gold/10 px-3 py-2 text-cream/90">{s(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Shell>
      );
    case "steps":
      return (
        <Shell title={spec.title}>
          <ol className="space-y-3">
            {arr<Item>(spec.items).map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rotate-45 border border-gold/70 bg-ink"><span className="-rotate-45 font-display text-[12px] text-gold-2">{i + 1}</span></span>
                <div><div className="font-display text-[17px] text-cream">{s(it.title)}</div>{it.body && <div className="font-body text-[14px] font-light leading-relaxed text-cream/80">{s(it.body)}</div>}</div>
              </li>
            ))}
          </ol>
        </Shell>
      );
    case "timeline":
      return (
        <Shell title={spec.title}>
          <div className="step-rail space-y-3">
            {arr<Item>(spec.items).map((it, i) => (
              <div key={i} className="step-node">
                <div className="font-body text-[11.5px] uppercase tracking-[0.16em] text-gold/80">{s(it.when)}</div>
                <div className="font-display text-[17px] text-cream">{s(it.title)}</div>
                {it.body && <div className="font-body text-[14px] font-light text-cream/80">{s(it.body)}</div>}
              </div>
            ))}
          </div>
        </Shell>
      );
    case "compare":
      return (
        <Shell title={spec.title}>
          <div className="grid gap-3 sm:grid-cols-2">
            {arr<Item>(spec.options).map((o, i) => (
              <div key={i} className="rounded-sm border border-gold/25 bg-black/40 p-3">
                <div className="font-display text-[19px] text-cream">{s(o.name)}</div>
                <ul className="mt-2 space-y-1 font-body text-[13.5px]">
                  {arr<string>(o.pros).map((p, j) => <li key={"p" + j} className="text-emerald-300/90">+ {s(p)}</li>)}
                  {arr<string>(o.cons).map((p, j) => <li key={"c" + j} className="text-rose-300/90">− {s(p)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Shell>
      );
    case "chart": {
      const bars = arr<Item>(spec.bars).map((b) => ({ label: s(b.label), value: Number(b.value) || 0 }));
      const max = Math.max(1, ...bars.map((b) => b.value));
      return (
        <Shell title={spec.title}>
          <div className="space-y-2">
            {bars.map((b, i) => (
              <div key={i} className="flex items-center gap-3 font-body text-[13px]">
                <span className="w-28 shrink-0 truncate text-cream/85" title={b.label}>{b.label}</span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-sm border border-gold/25 bg-black/50">
                  <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/40 to-gold" style={{ width: `${(b.value / max) * 100}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[12px] text-gold-2">{b.value}{spec.unit ? ` ${s(spec.unit)}` : ""}</span>
              </div>
            ))}
          </div>
        </Shell>
      );
    }
    case "callout": {
      const tone = spec.tone === "warn" ? "border-amber-400/50 text-amber-100" : spec.tone === "tip" ? "border-emerald-400/40 text-emerald-100" : "border-gold/45 text-cream";
      return (
        <div className={`gen-ui decode-in my-4 rounded-md border bg-black/45 px-4 py-3 ${tone}`}>
          {spec.title && <div className="font-display text-[17px]">{s(spec.title)}</div>}
          <div className="font-body text-[14.5px] font-light leading-relaxed opacity-90">{s(spec.body)}</div>
        </div>
      );
    }
    default:
      return null;
  }
}

const BARE = /(^|\n)(\{\s*"type"\s*:\s*"(?:stats|table|steps|timeline|compare|chart|callout)")/;

/** Models sometimes drop the ```dai-ui fence; wrap a bare spec object so it still renders. */
export function wrapBareGenUI(text: string): string {
  let out = "";
  let rest = text;
  for (let guard = 0; guard < 6; guard++) {
    const m = BARE.exec(rest);
    if (!m) break;
    const start = m.index + m[1].length;
    const head = rest.slice(0, start);
    if ((((out + head).match(/```/g) || []).length % 2) === 1) break; // already inside a fence
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < rest.length; i++) {
      const c = rest[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) { end = i + 1; break; }
    }
    if (end < 0) return out + head + "\n```dai-ui\n" + rest.slice(start); // still streaming
    out += head + "\n```dai-ui\n" + rest.slice(start, end) + "\n```\n";
    rest = rest.slice(end);
  }
  return out + rest;
}
