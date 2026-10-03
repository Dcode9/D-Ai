import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Plate } from "./frames/Plate";

type Summary = { title: string; description?: string; extract?: string; thumb?: string; url?: string };
type Section = { heading: string; body: string };
type Img = { thumb: string; full: string; title: string; credit: string };

const WIKI = "https://en.wikipedia.org";
const cache = new Map<string, unknown>();

async function getJSON<T>(url: string): Promise<T | null> {
  if (cache.has(url)) return cache.get(url) as T;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as T;
    cache.set(url, j);
    return j;
  } catch {
    return null;
  }
}

export function openWiki(title: string) {
  window.dispatchEvent(new CustomEvent("dai:open-wiki", { detail: { title } }));
}

/** Wikipedia /wiki/Title URL -> title, else null */
export function wikiTitleFromHref(href: string): string | null {
  try {
    const u = new URL(href, window.location.href);
    if (!/(^|\.)wikipedia\.org$/.test(u.hostname) || !u.pathname.startsWith("/wiki/")) return null;
    return decodeURIComponent(u.pathname.slice(6)).replace(/_/g, " ");
  } catch {
    return null;
  }
}

function parseSections(text: string): Section[] {
  const out: Section[] = [];
  const skip = /^(see also|references|external links|further reading|notes|bibliography|sources|citations)$/i;
  let cur: Section = { heading: "", body: "" };
  for (const line of text.split("\n")) {
    const m = line.match(/^(={2,4})\s*(.+?)\s*\1\s*$/);
    if (m) {
      if (cur.body.trim()) out.push(cur);
      cur = { heading: m[2], body: "" };
    } else cur.body += line + "\n";
  }
  if (cur.body.trim()) out.push(cur);
  return out.filter((s) => !skip.test(s.heading)).map((s) => ({ ...s, body: s.body.trim() })).slice(0, 8);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
}

type Props = { open: boolean; onClose: () => void; request: { title: string; n: number } | null };

export function WikiDrawer({ open, onClose, request }: Props) {
  const [stack, setStack] = useState<string[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [related, setRelated] = useState<string[]>([]);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "missing">("idle");
  const [q, setQ] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const title = stack[stack.length - 1];

  useEffect(() => {
    if (request?.title) setStack([request.title]);
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!title) return;
    let dead = false;
    setState("loading");
    setSum(null); setSections([]); setRelated([]); setImgs([]);
    scroller.current?.scrollTo({ top: 0 });
    const enc = encodeURIComponent(title.replace(/ /g, "_"));
    (async () => {
      const s = await getJSON<any>(`${WIKI}/api/rest_v1/page/summary/${enc}?redirect=true`);
      if (dead) return;
      if (!s || s.type === "https://mediawiki.org/wiki/HyperSwitch/errors/not_found" || !s.title) {
        // fall back to search
        const f = await getJSON<any>(`${WIKI}/w/api.php?action=opensearch&search=${encodeURIComponent(title)}&limit=1&format=json&origin=*`);
        const alt = f?.[1]?.[0];
        if (alt && alt !== title) { setStack((st) => [...st.slice(0, -1), alt]); return; }
        setState("missing");
        return;
      }
      setSum({ title: s.title, description: s.description, extract: s.extract, thumb: s.thumbnail?.source, url: s.content_urls?.desktop?.page });
      setState("idle");
      const canon = s.title as string;
      const [full, links, commons] = await Promise.all([
        getJSON<any>(`${WIKI}/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&titles=${encodeURIComponent(canon)}&format=json&origin=*&redirects=1`),
        getJSON<any>(`${WIKI}/w/api.php?action=query&prop=links&pllimit=60&plnamespace=0&titles=${encodeURIComponent(canon)}&format=json&origin=*&redirects=1`),
        getJSON<any>(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(canon + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=420&format=json&origin=*`),
      ]);
      if (dead) return;
      const page: any = full?.query?.pages && Object.values(full.query.pages)[0];
      if (page?.extract) {
        const secs = parseSections(page.extract as string);
        // the first (heading-less) block duplicates the summary; keep it only if it is much longer
        setSections(secs[0] && !secs[0].heading && secs[0].body.length < (s.extract || "").length * 1.3 ? secs.slice(1) : secs);
      }
      const lp: any = links?.query?.pages && Object.values(links.query.pages)[0];
      const rel = ((lp?.links as { title: string }[]) || []).map((l) => l.title).filter((t) => t.length < 40 && !/^(List of|Index of)/.test(t));
      setRelated(rel.slice(0, 14));
      const ims: Img[] = Object.values(commons?.query?.pages || {}).map((p: any) => {
        const ii = p.imageinfo?.[0];
        const md = ii?.extmetadata || {};
        return ii?.thumburl && /\.(jpe?g|png|webp)(\?|$)/i.test(ii.url)
          ? { thumb: ii.thumburl as string, full: (ii.descriptionurl || ii.url) as string, title: String(p.title || "").replace(/^File:/, "").replace(/\.\w+$/, ""), credit: [stripHtml(md.Artist?.value || ""), md.LicenseShortName?.value].filter(Boolean).join(" · ") }
          : null;
      }).filter(Boolean) as Img[];
      setImgs(ims.slice(0, 8));
    })();
    return () => { dead = true; };
  }, [title]);

  const go = (t: string) => setStack((st) => [...st, t]);

  return (
    <>
      <div className={cn("absolute inset-0 z-30 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} />
      <aside
        className={cn(
          "absolute right-0 top-0 z-40 h-full w-[min(560px,98vw)] pb-[env(safe-area-inset-bottom)] drop-shadow-[0_0_40px_rgba(0,0,0,.7)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <Plate variant="text" className="flex h-full flex-col">
          <div className="relative flex items-center justify-between gap-3 px-8 pb-3 pt-8 sm:px-9 sm:pt-9">
            <div className="flex min-w-0 items-center gap-3">
              {stack.length > 1 && (
                <button type="button" onClick={() => setStack((st) => st.slice(0, -1))} aria-label="Back" className="cursor-pointer text-gold/70 transition-colors hover:text-cream">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                </button>
              )}
              <h2 className="truncate font-display text-[26px] text-cream">Wiki</h2>
              <span className="font-body text-[11px] uppercase tracking-[0.18em] text-gold/70">Wikipedia</span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-gold/70 transition-colors hover:text-cream">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <form className="relative mx-8 mb-3 sm:mx-9" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { go(q.trim()); setQ(""); } }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up anything…" className="w-full rounded-sm border border-gold/30 bg-black/40 px-3 py-2 font-body text-[14px] text-cream outline-none placeholder:text-muted focus:border-gold/60" />
          </form>

          <div ref={scroller} className="relative flex-1 overflow-y-auto px-8 pb-9 sm:px-9 scroll-gold">
            {state === "loading" && !sum && <p className="font-display italic text-gold/70">Opening “{title}”…</p>}
            {state === "missing" && <p className="font-body text-[14px] text-muted">No Wikipedia page found for “{title}”.</p>}
            {sum && (
              <article>
                <h3 className="font-display text-[34px] leading-tight text-cream">{sum.title}</h3>
                {sum.description && <p className="mt-1 font-body text-[13px] uppercase tracking-[0.14em] text-gold/70">{sum.description}</p>}
                {sum.thumb && <img src={sum.thumb} alt={sum.title} loading="lazy" className="mt-4 max-h-[260px] w-full rounded-sm border border-gold/25 object-cover" />}
                {sum.extract && <p className="mt-4 font-body text-[15px] font-light leading-relaxed text-cream/90">{sum.extract}</p>}
                {sections.map((s, i) => (
                  <details key={i} className="group mt-3 border-t border-gold/20 pt-2" open={!s.heading}>
                    {s.heading && <summary className="cursor-pointer list-none font-display text-[20px] text-cream/90 transition-colors hover:text-gold">{s.heading}</summary>}
                    <p className="mt-2 whitespace-pre-line font-body text-[14.5px] font-light leading-relaxed text-cream/80">{s.body.length > 1800 ? s.body.slice(0, 1800) + "…" : s.body}</p>
                  </details>
                ))}
                {imgs.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-display text-[20px] text-cream/90">Images <span className="font-body text-[11px] uppercase tracking-[0.18em] text-gold/60">Wikimedia Commons</span></h4>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {imgs.map((im, i) => (
                        <a key={i} href={im.full} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-sm border border-gold/25">
                          <img src={im.thumb} alt={im.title} loading="lazy" className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                          <span className="block truncate bg-black/50 px-2 py-1 font-body text-[11px] text-muted" title={im.credit}>{im.credit || im.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {related.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-display text-[20px] text-cream/90">Related</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {related.map((t) => (
                        <button key={t} type="button" onClick={() => go(t)} className="cursor-pointer rounded-sm border border-gold/30 px-2.5 py-1 font-body text-[13px] text-gold/90 transition-colors hover:border-gold/70 hover:text-cream">{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {sum.url && <a href={sum.url} target="_blank" rel="noreferrer" className="mt-6 inline-block font-body text-[12px] text-gold/70 hover:text-cream">Read on Wikipedia ↗ · text CC BY-SA</a>}
              </article>
            )}
          </div>
        </Plate>
      </aside>
    </>
  );
}
