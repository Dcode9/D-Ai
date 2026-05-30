const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// Themed error loader text
indexHtml = indexHtml.replace(
  `<div class="text-gray-500 text-xs font-mono">
                            Retrying in <span class="error-countdown" id="error-countdown">10</span> seconds...
                        </div>`,
  `<div class="text-dai-muted text-xs font-serif" style="margin-top: 10px;">
                            The connection wavers. Re-establishing the arcane link in <span class="error-countdown" id="error-countdown" style="font-weight:bold; color:var(--dai-text);">10</span> seconds...
                        </div>`
);

// Final retry fail
indexHtml = indexHtml.replace(
  `el.innerHTML = \`<div class="text-red-500 text-xs mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><strong>⚠️ Connection Error:</strong> D'Ai is having trouble connecting. Please check your connection and try again.</div>\`;`,
  `el.innerHTML = \`<div class="dai-widget"><div class="dai-widget-head" style="border-bottom-color: rgba(239, 68, 68, 0.4);"><span class="dai-widget-kicker" style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Link Severed</span></div><div class="dai-widget-body"><div class="dai-widget-note" style="color: #ef4444;">The mystical connection to the aether is severed. Please try again later.</div></div></div>\`;`
);

fs.writeFileSync('index.html', indexHtml);
