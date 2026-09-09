import katex from "katex";
import { marked } from "marked";

/**
 * Pre-processes text to extract LaTeX math formulas and replace them with safe placeholders.
 * This prevents markdown parsers from mangling LaTeX underscores, asterisks, and pipes (especially inside tables).
 */
export function processMathAndMarkdown(rawText: string): string {
  if (!rawText) return "";

  const mathPlaceholders: Map<string, { math: string; display: boolean }> = new Map();
  let counter = 0;

  // 1. Extract Display Math: $$ ... $$ and \[ ... \]
  let text = rawText.replace(
    /(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])/g,
    (_, _full, math1, math2) => {
      const math = (math1 || math2 || "").trim();
      const placeholder = `%%%KATEX_BLOCK_${counter++}%%%`;
      mathPlaceholders.set(placeholder, { math, display: true });
      return `\n\n${placeholder}\n\n`;
    },
  );

  // 2. Protect Currency strings: e.g. $100, $50.00, $10,000, \$50
  const currencyPlaceholders: Map<string, string> = new Map();
  let currCounter = 0;
  text = text.replace(/(?:\\\$|\$)(?=\d)/g, () => {
    const p = `%%%CURRENCY_${currCounter++}%%%`;
    currencyPlaceholders.set(p, "$");
    return p;
  });

  // 3. Extract Inline Math: $ ... $ and \( ... \)
  text = text.replace(
    /(?:(?<!\\)\$([^\$\n]+?)(?<!\\)\$|\\\((.+?)\\\))/g,
    (_, math1, math2) => {
      const math = (math1 || math2 || "").trim();
      if (!math) return "";
      const placeholder = `%%%KATEX_INLINE_${counter++}%%%`;
      mathPlaceholders.set(placeholder, { math, display: false });
      return placeholder;
    },
  );

  // 4. Parse markdown with marked
  let html = marked.parse(text, { gfm: true, breaks: true }) as string;

  // 5. Ornate styling post-processor for HTML elements
  // Wrap tables in horizontal scroll containers with distinct column dividers and headers
  html = html.replace(
    /<table>([\s\S]*?)<\/table>/g,
    `<div class="table-container my-4 overflow-x-auto scroll-gold rounded-lg border border-gold/30 bg-black/40 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
      <table class="w-full min-w-[560px] border-collapse text-left font-body text-[14px] leading-relaxed">$1</table>
    </div>`,
  );

  html = html.replace(/<thead>/g, '<thead class="border-b-2 border-gold/40 bg-gold/[0.08] text-gold-2">');
  html = html.replace(/<tbody>/g, '<tbody class="divide-y divide-gold/15">');
  html = html.replace(/<tr>/g, '<tr class="transition-colors hover:bg-gold/[0.04] even:bg-white/[0.015]">');

  // Add distinct borders, whitespace protection, and typography to <th> and <td> cells
  html = html.replace(
    /<th([^>]*)>/g,
    '<th$1 class="border-r border-gold/25 last:border-r-0 px-5 py-3 font-display text-[13px] uppercase tracking-[0.14em] font-medium text-cream whitespace-nowrap">',
  );

  html = html.replace(
    /<td([^>]*)>/g,
    '<td$1 class="border-r border-gold/20 last:border-r-0 px-5 py-3 text-[#ded4bf] align-top text-[14px]">',
  );

  // Convert list breaks inside table cells (<br>• or <br>-) into gold diamond markers
  html = html.replace(/(?:<br\s*\/?>)\s*([•\-\*])\s*/gi, '<br><span class="text-gold mr-1.5">◆</span>');

  // Blockquotes: Ornate gold left rail with luxury typography
  html = html.replace(
    /<blockquote>([\s\S]*?)<\/blockquote>/g,
    '<blockquote class="my-3.5 rounded-r-md border-l-2 border-gold/70 bg-gold/[0.04] px-4 py-2.5 font-body text-[13.5px] italic text-[#ded4bf]">$1</blockquote>',
  );

  // Unordered lists with gold diamond bullets
  html = html.replace(
    /<ul>([\s\S]*?)<\/ul>/g,
    '<ul class="my-2.5 space-y-1.5 pl-5 font-body text-[13.5px] leading-relaxed text-[#ded4bf] list-none">$1</ul>',
  );

  // Ordered lists
  html = html.replace(
    /<ol(\s+start="(\d+)")?>([\s\S]*?)<\/ol>/g,
    '<ol$1 class="my-2.5 list-decimal space-y-1.5 pl-6 font-body text-[13.5px] leading-relaxed text-[#ded4bf] marker:text-gold">$3</ol>',
  );

  // List items inside unordered lists get diamond markers
  html = html.replace(
    /<ul([^>]*)>([\s\S]*?)<\/ul>/g,
    (_full, attrs, inner) => {
      const styledInner = inner.replace(
        /<li>([\s\S]*?)<\/li>/g,
        '<li class="relative pl-1"><span class="absolute -left-4 text-gold text-[10px] top-[4px]">◆</span>$1</li>',
      );
      return `<ul${attrs}>${styledInner}</ul>`;
    },
  );

  // Links: Gold styling with external link indicator
  html = html.replace(
    /<a\s+href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g,
    (_full, href, extraAttrs, linkText) => {
      const isExternal = href.startsWith("http://") || href.startsWith("https://");
      const icon = isExternal
        ? `<svg class="inline-block h-3 w-3 shrink-0 text-gold/60 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
        : "";
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${href}"${extraAttrs}${target} class="inline-flex items-center font-medium text-gold hover:text-cream underline underline-offset-2 transition-colors"><span>${linkText}</span>${icon}</a>`;
    },
  );

  // Standalone inline <code> (not inside <pre>)
  html = html.replace(
    /(?<!<pre[^>]*>[\s\S]*?)<code>([^<]+)<\/code>(?![\s\S]*?<\/pre>)/g,
    '<code class="rounded border border-gold/30 bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-[#e8d7b8] break-all select-all">$1</code>',
  );

  // 6. Restore Math Placeholders with KaTeX rendered HTML
  mathPlaceholders.forEach(({ math, display }, placeholder) => {
    try {
      const renderedMath = katex.renderToString(math, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });

      if (display) {
        const wrapped = `<div class="katex-display-wrapper my-3 overflow-x-auto scroll-gold py-2.5 px-3 bg-black/30 rounded-md border border-gold/20 text-center shadow-inner">${renderedMath}</div>`;
        // Replace potential wrapping <p> tags
        html = html.replace(new RegExp(`<p>\\s*${placeholder}\\s*<\\/p>`, "g"), wrapped);
        html = html.replace(placeholder, wrapped);
      } else {
        html = html.replace(placeholder, `<span class="katex-inline-wrapper px-0.5">${renderedMath}</span>`);
      }
    } catch (e) {
      console.warn("KaTeX rendering error:", e);
      html = html.replace(placeholder, display ? `$$${math}$$` : `$${math}$`);
    }
  });

  // 7. Restore Currency symbols
  currencyPlaceholders.forEach((symbol, p) => {
    html = html.replaceAll(p, symbol);
  });

  return html;
}
