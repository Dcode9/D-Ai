        document.addEventListener("DOMContentLoaded", () => {
            const checkDeps = () => window.markdownit && window.texmath && window.katex && window.hljs && window.DOMPurify;
            const normalizeMathDelimiters = (text) => String(text || '')
                .replace(/[\u00a0\u202f]/g, ' ')
                .replace(/(^|[^\\])\\\[/g,'$1$$$$').replace(/\\\]/g,'$$$$')
                .replace(/(^|[^\\])\\\(/g,'$1$').replace(/\\\)/g,'$');

            const sanitizeRenderedHtml = (html) => window.DOMPurify.sanitize(html, {
                ADD_TAGS: ['svg', 'defs', 'filter', 'feGaussianBlur', 'rect', 'button'],
                ADD_ATTR: [
                    'target', 'rel', 'style', 'controls', 'loop', 'autoplay', 'muted', 'playsinline',
                    'data-dai-media', 'data-dai-widget', 'data-widget-type', 'data-code-action',
                    'data-table-action', 'data-dai-action', 'data-message-action', 'data-message-index', 'data-topic', 'data-kind', 'data-prompt', 'data-width', 'data-height',
                    'data-seed', 'data-container-id', 'data-source', 'data-ratio', 'data-duration',
                    'data-style', 'data-filename', 'pathLength', 'stroke-dasharray', 'stroke-dashoffset',
                    'stroke-linecap', 'stroke-width', 'stroke-opacity', 'stdDeviation', 'result',
                    'x', 'y', 'rx', 'fill', 'stroke', 'filter', 'class', 'type', 'aria-label'
                ],
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus']
            });

            const renderWidgetShell = (id, type, title) => `
<div class="dai-widget" data-dai-widget="${escapeHtml(id)}" data-widget-type="${escapeHtml(type)}">
    <div class="dai-widget-head">
        <span>${escapeHtml(title || 'Interactive answer')}</span>
        <span class="dai-widget-kicker">${escapeHtml(type)}</span>
    </div>
    <div class="dai-widget-body"><div class="dai-widget-note">Preparing interactive view...</div></div>
</div>`;

            let md = null;
            const getMd = () => {
                if(md) return md;
                if(!checkDeps()) return null;
                md = window.markdownit({html:true,breaks:true,linkify:true,highlight:(s,l)=>l&&hljs.getLanguage(l)?hljs.highlight(s,{language:l}).value:''});
                md.disable('code').use(texmath,{engine:katex,delimiters:'dollars'});
                md.renderer.rules.table_open=()=>'<div class="table-scroll"><table>';
                md.renderer.rules.table_close=()=>'</table></div>';
                md.renderer.rules.math_block=(tokens, idx) => {
                    try {
                        return `<div class="math-block">${katex.renderToString(tokens[idx].content, { displayMode: true, throwOnError: false })}</div>`;
                    } catch (e) {
                        return `<div class="math-block">${md.utils.escapeHtml(tokens[idx].content)}</div>`;
                    }
                };
                md.renderer.rules.fence=(t,i)=>{
                    const info = (t[i].info || 'text').trim();
                    const parts = info.split(/\s+/).filter(Boolean);
                    const lang = (parts[0] || 'text').toLowerCase();
                    const raw = t[i].content || '';

                    if (lang === 'dai-ui') {
                        const type = (parts[1] || 'demo').toLowerCase();
                        let title = type === 'chart' ? 'Live chart' : type === 'pythagoras' ? 'Interactive theorem' : 'Interactive demo';
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.title) title = parsed.title;
                        } catch (e) {}
                        const widgetId = stableId('dai-ui', `${i}:${type}:${raw}`);
                        window.daiWidgetPayloads.set(widgetId, { type, raw });
                        return renderWidgetShell(widgetId, type, title);
                    }

                    const displayLang = lang || 'text';
                    const escapedLang = md.utils.escapeHtml(displayLang);
                    const highlighted = displayLang && window.hljs.getLanguage(displayLang)
                        ? window.hljs.highlight(raw, { language: displayLang }).value
                        : md.utils.escapeHtml(raw);
                    const canPreview = ['html', 'htm', 'xml', 'javascript', 'js', 'css', 'svg'].includes(displayLang) || raw.includes('<html') || raw.includes('<div') || raw.includes('function');
                    const previewButton = canPreview
                        ? '<button class="code-action" title="Preview & Edit in Code Studio" data-code-action="preview"><i class="fa-solid fa-code"></i></button>'
                        : '';
                    return `<div class="code-box collapsed" data-code-lang="${escapedLang}"><div class="code-head"><span>${escapedLang}</span><span class="code-actions">${previewButton}<button class="code-action" title="Wrap lines" data-code-action="wrap"><i class="fa-solid fa-arrow-right-arrow-left"></i></button><button class="code-action" title="Toggle detail" data-code-action="toggle"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button><button class="code-action" title="Copy code" data-code-action="copy"><i class="fa-regular fa-copy"></i></button></span></div><div class="code-body"><pre><code class="hljs language-${escapedLang}">${highlighted}</code></pre></div></div>`;
                };
                return md;
            };

            const Putter = {
                generate: (input, key = '') => {
                    console.log('[Putter.generate] Input:', input);
                    const parts = input.split('|').map(s=>s.trim());
                    const prompt = parts[0];
                    const ratio = parts[1] || "1:1";
                    const filename = parts[2] || `DAi_Image_${Date.now()}`;
                    const sourceImage = (parts[3] && parts[3] !== "undefined" && parts[3] !== "no source image") ? parts[3] : "";

                    console.log('[Putter.generate] Parsed:', { prompt, ratio, filename, sourceImage });

                    const dims = { "1:1":{w:1024,h:1024}, "16:9":{w:1280,h:720}, "9:16":{w:720,h:1280}, "4:3":{w:1024,h:768}, "3:4":{w:768,h:1024}, "landscape":{w:1280,h:720}, "portrait":{w:720,h:1280} };
                    const {w,h} = dims[ratio.toLowerCase()] || dims["1:1"];

                    const seed = Math.abs(hashCode(prompt)) % 10000;

                    const uniqueSuffix = key || stableId('img', input);
                    const btnId = `dl-${uniqueSuffix}`;
                    const containerId = `cnt-${uniqueSuffix}`;

                    const placeholder = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

                    const safePrompt = encodeURIComponent(prompt).replace(/'/g, "%27");
                    const safeFilename = encodeURIComponent(filename).replace(/'/g, "%27");
                    const safeSource = sourceImage ? encodeURIComponent(sourceImage).replace(/'/g, "%27") : "";

                    // New Fluid Animation Structure inside container
                    return `
<div id="${containerId}" class="dai-img-container" style="aspect-ratio:${w}/${h}" data-dai-media="image" data-prompt="${safePrompt}" data-width="${w}" data-height="${h}" data-seed="${seed}" data-container-id="${containerId}" data-source="${safeSource}">
    <svg class="progress-svg"><defs><filter id="glow-${uniqueSuffix}"><feGaussianBlur stdDeviation="6" result="coloredBlur"/></filter></defs><rect class="progress-rect" x="0" y="0" width="100%" height="100%" rx="20" fill="none" stroke="#3b82f6" stroke-width="20" pathLength="100" stroke-dasharray="100 200" stroke-dashoffset="100" stroke-linecap="round" filter="url(#glow-${uniqueSuffix})" style="stroke-opacity:0;"></rect></svg>
    <div class="fluid-container"><div class="absolute inset-0 bg-gradient-to-br from-gray-900 to-black"></div><div class="blobs-wrapper absolute inset-0 overflow-hidden"></div></div>
    <div class="gen-status">Generating...</div>
    <img src="${placeholder}" class="dai-img" alt="Generated Image">
    <div class="dai-overlay"><button id="${btnId}" class="dai-btn" title="Download High-Res" data-dai-action="download-image" data-filename="${safeFilename}"><i class="fa-solid fa-download"></i></button></div>
</div>`;
                },
                generateVideo: (input, key = '') => {
                    console.log('[Putter.generateVideo] Input:', input);
                    const parts = input.split('|').map(s=>s.trim());
                    const prompt = parts[0];
                    const aspectRatio = parts[1] || "16:9";
                    const duration = parts[2] || "3";
                    const filename = parts[3] || `DAi_Video_${Date.now()}`;
                    const sourceImage = (parts[4] && parts[4] !== "undefined" && parts[4] !== "no source image") ? parts[4] : "";

                    console.log('[Putter.generateVideo] Parsed:', { prompt, aspectRatio, duration, filename, sourceImage });

                    const dims = { "1:1":{w:1024,h:1024}, "16:9":{w:1280,h:720}, "9:16":{w:720,h:1280}, "4:3":{w:1024,h:768}, "3:4":{w:768,h:1024}, "landscape":{w:1280,h:720}, "portrait":{w:720,h:1280} };
                    const {w,h} = dims[aspectRatio.toLowerCase()] || dims["16:9"];

                    const uniqueSuffix = key || stableId('video', input);
                    const btnId = `dl-${uniqueSuffix}`;
                    const containerId = `cnt-${uniqueSuffix}`;

                    const safePrompt = encodeURIComponent(prompt).replace(/'/g, "%27");
                    const safeFilename = encodeURIComponent(filename).replace(/'/g, "%27");
                    const safeSource = sourceImage ? encodeURIComponent(sourceImage).replace(/'/g, "%27") : "";
                    const safeAspectRatio = escapeHtml(aspectRatio);
                    const safeDuration = escapeHtml(String(Math.min(Math.max(parseInt(duration, 10) || 4, 1), 10)));

                    // New Fluid Animation Structure inside container
                    const html = `
<div id="${containerId}" class="dai-video-container" style="aspect-ratio:${w}/${h}" data-dai-media="video" data-prompt="${safePrompt}" data-width="${w}" data-height="${h}" data-duration="${safeDuration}" data-ratio="${safeAspectRatio}" data-container-id="${containerId}" data-source="${safeSource}">
    <svg class="progress-svg"><defs><filter id="glow-${uniqueSuffix}"><feGaussianBlur stdDeviation="6" result="coloredBlur"/></filter></defs><rect class="progress-rect" x="0" y="0" width="100%" height="100%" rx="20" fill="none" stroke="#3b82f6" stroke-width="20" pathLength="100" stroke-dasharray="100 200" stroke-dashoffset="100" stroke-linecap="round" filter="url(#glow-${uniqueSuffix})" style="stroke-opacity:0;"></rect></svg>
    <div class="fluid-container"><div class="absolute inset-0 bg-gradient-to-br from-gray-900 to-black"></div><div class="blobs-wrapper absolute inset-0 overflow-hidden"></div></div>
    <div class="gen-status">Generating Video...</div>
    <video class="dai-video" controls loop autoplay muted>Your browser does not support the video tag.</video>
    <div class="dai-watermark">D'Ai</div>
    <div class="dai-overlay"><button id="${btnId}" class="dai-btn" title="Download Video" data-dai-action="download-video" data-filename="${safeFilename}"><i class="fa-solid fa-download"></i></button></div>
</div>`;
                    return html;
                },
                generateMusic: (input, key = '') => {
                    console.log('[Putter.generateMusic] Input:', input);
                    const parts = input.split('|').map(s=>s.trim());
                    const prompt = parts[0];
