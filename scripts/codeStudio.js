(function () {
  let drawer = null;
  let backdrop = null;
  let codeEditor = null;
  let previewIframe = null;
  let currentLang = 'html';
  let viewMode = 'split'; // 'split', 'editor', 'preview'

  function createCodeStudioUI() {
    if (document.getElementById('code-studio-drawer')) return;

    // Dark backdrop overlay
    backdrop = document.createElement('div');
    backdrop.id = 'code-studio-backdrop';
    backdrop.className = 'fixed inset-0 z-[140] bg-black/80 backdrop-blur-md opacity-0 pointer-events-none transition-opacity duration-300';
    document.body.appendChild(backdrop);

    drawer = document.createElement('div');
    drawer.id = 'code-studio-drawer';
    drawer.className = 'fixed inset-y-0 right-0 z-[150] w-full lg:w-[720px] xl:w-[840px] bg-[#0a0c12] border-l border-white/20 shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300 ease-in-out font-sans text-gray-200';
    
    drawer.innerHTML = `
      <!-- Studio Header -->
      <div class="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 bg-[#121520] gap-2 pt-[max(0.65rem,env(safe-area-inset-top,0px))]">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 text-xs sm:text-sm flex-shrink-0">
            <i class="fa-solid fa-code"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 sm:gap-2">
              <h3 class="text-xs font-bold text-white tracking-wide truncate">Code Studio</h3>
              <span id="studio-lang-badge" class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">HTML</span>
            </div>
            <p class="text-[9px] sm:text-[10px] text-gray-400 hidden xs:block truncate">Edit code & preview live</p>
          </div>
        </div>

        <!-- Mode Switches & Actions -->
        <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <div class="flex p-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] sm:text-[11px]">
            <button id="studio-mode-split" class="px-2 sm:px-2.5 py-1 rounded-md text-white font-medium bg-white/10 transition-colors hidden sm:inline-block" title="Split view">Split</button>
            <button id="studio-mode-editor" class="px-2 sm:px-2.5 py-1 rounded-md text-gray-400 hover:text-white transition-colors" title="Editor view">Editor</button>
            <button id="studio-mode-preview" class="px-2 sm:px-2.5 py-1 rounded-md text-gray-400 hover:text-white transition-colors" title="Preview view">Preview</button>
          </div>

          <button id="studio-copy-btn" class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-gray-300 flex items-center justify-center transition-colors cursor-pointer" title="Copy code">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button id="studio-run-btn" class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/20 hover:bg-sky-500/30 text-[11px] sm:text-xs font-semibold text-sky-300 transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer" title="Re-run preview">
            <i class="fa-solid fa-play text-[9px] sm:text-[10px]"></i> <span class="hidden xs:inline">Run</span>
          </button>
          <button id="studio-close-btn" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors ml-0.5 cursor-pointer" title="Close Code Studio (Esc)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Studio Workspace Panes -->
      <div id="studio-panes-container" class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/10 bg-[#07080d] pb-[env(safe-area-inset-bottom,0px)]">
        <!-- Editor Pane -->
        <div id="studio-pane-editor" class="flex-1 flex flex-col min-h-0 bg-[#050608]">
          <div class="px-3 py-1.5 sm:py-2 bg-[#10121b] border-b border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] text-gray-400 font-mono">
            <span class="flex items-center gap-1.5"><i class="fa-regular fa-file-code text-sky-400"></i> Source Code</span>
            <span id="studio-char-count" class="text-[9px] sm:text-[10px] opacity-60">0 chars</span>
          </div>
          <div class="flex-1 relative flex overflow-hidden">
            <textarea id="studio-editor" class="w-full h-full p-3 sm:p-4 bg-[#07090e] font-mono text-xs sm:text-sm text-emerald-300 focus:outline-none resize-none leading-relaxed border-0" spellcheck="false" placeholder="Enter HTML/CSS/JS code..."></textarea>
          </div>
        </div>

        <!-- Live Preview Pane -->
        <div id="studio-pane-preview" class="flex-1 flex flex-col min-h-0 bg-slate-950">
          <div class="px-3 py-1.5 sm:py-2 bg-[#10121b] border-b border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] text-gray-400 font-mono">
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-desktop text-emerald-400"></i> Live Preview</span>
            <button id="studio-fullscreen-btn" class="text-sky-400 hover:text-sky-300 text-[10px] flex items-center gap-1 cursor-pointer" title="Open in new window">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> New Tab
            </button>
          </div>
          <div class="flex-1 relative bg-white overflow-hidden">
            <iframe id="studio-preview-iframe" class="w-full h-full border-0 bg-white" sandbox="allow-scripts allow-modals allow-forms allow-same-origin"></iframe>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

    codeEditor = drawer.querySelector('#studio-editor');
    previewIframe = drawer.querySelector('#studio-preview-iframe');

    let debounceTimer = null;
    codeEditor.addEventListener('input', () => {
      const charCount = drawer.querySelector('#studio-char-count');
      if (charCount) charCount.textContent = `${codeEditor.value.length} chars`;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updatePreview, 350);
    });

    backdrop.addEventListener('click', closeStudio);
    drawer.querySelector('#studio-close-btn').addEventListener('click', closeStudio);
    drawer.querySelector('#studio-run-btn').addEventListener('click', updatePreview);
    
    drawer.querySelector('#studio-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(codeEditor.value || '');
      if (window.showToast) window.showToast('Code copied to clipboard!', 'fa-regular fa-copy text-sky-400');
    });

    drawer.querySelector('#studio-fullscreen-btn').addEventListener('click', () => {
      const blob = new Blob([codeEditor.value || ''], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });

    // View Mode Toggle Listeners
    const btnSplit = drawer.querySelector('#studio-mode-split');
    const btnEditor = drawer.querySelector('#studio-mode-editor');
    const btnPreview = drawer.querySelector('#studio-mode-preview');

    const setViewMode = (mode) => {
      viewMode = mode;
      const paneEditor = drawer.querySelector('#studio-pane-editor');
      const panePreview = drawer.querySelector('#studio-pane-preview');

      [btnSplit, btnEditor, btnPreview].forEach(b => {
        if (b) {
          b.classList.remove('text-white', 'bg-white/10');
          b.classList.add('text-gray-400');
        }
      });

      if (mode === 'split' && window.innerWidth >= 640) {
        if (btnSplit) {
          btnSplit.classList.add('text-white', 'bg-white/10');
          btnSplit.classList.remove('text-gray-400');
        }
        paneEditor.classList.remove('hidden');
        panePreview.classList.remove('hidden');
      } else if (mode === 'editor') {
        if (btnEditor) {
          btnEditor.classList.add('text-white', 'bg-white/10');
          btnEditor.classList.remove('text-gray-400');
        }
        paneEditor.classList.remove('hidden');
        panePreview.classList.add('hidden');
      } else { // 'preview'
        if (btnPreview) {
          btnPreview.classList.add('text-white', 'bg-white/10');
          btnPreview.classList.remove('text-gray-400');
        }
        paneEditor.classList.add('hidden');
        panePreview.classList.remove('hidden');
      }
    };

    if (btnSplit) btnSplit.addEventListener('click', () => setViewMode('split'));
    if (btnEditor) btnEditor.addEventListener('click', () => setViewMode('editor'));
    if (btnPreview) btnPreview.addEventListener('click', () => setViewMode('preview'));

    drawer.dataset.setViewMode = setViewMode;
  }

  function updatePreview() {
    if (!previewIframe || !codeEditor) return;
    const code = codeEditor.value || '';
    
    let finalDoc = code;
    if (currentLang === 'javascript' || currentLang === 'js') {
      finalDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></head><body class="p-4 bg-slate-900 text-white font-sans"><div id="app"></div><script>${code}</script></body></html>`;
    } else if (currentLang === 'css') {
      finalDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${code}</style></head><body class="p-4 bg-slate-900 text-white"><div class="demo-box">CSS Live Preview</div></body></html>`;
    } else if (!code.includes('<html') && !code.includes('<!DOCTYPE')) {
      finalDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></head><body class="p-4 bg-slate-900 text-white font-sans">${code}</body></html>`;
    }

    previewIframe.srcdoc = finalDoc;
  }

  function openStudio(code, lang = 'html') {
    createCodeStudioUI();
    currentLang = (lang || 'html').toLowerCase();
    
    const langBadge = drawer.querySelector('#studio-lang-badge');
    if (langBadge) langBadge.textContent = currentLang.toUpperCase();

    codeEditor.value = code || '';
    const charCount = drawer.querySelector('#studio-char-count');
    if (charCount) charCount.textContent = `${(code || '').length} chars`;

    // On mobile screens (< 640px), default to Preview mode
    const isMobile = window.innerWidth < 640;
    const initialMode = isMobile ? 'preview' : 'split';
    
    const setModeFn = drawer.dataset.setViewMode;
    if (typeof setModeFn === 'function') {
      setModeFn(initialMode);
    }

    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    drawer.classList.remove('translate-x-full');
    drawer.classList.add('translate-x-0');
    
    updatePreview();
  }

  function closeStudio() {
    if (!drawer) return;
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    if (backdrop) backdrop.classList.add('opacity-0', 'pointer-events-none');
  }

  window.openCodeStudio = openStudio;
  window.closeCodeStudio = closeStudio;
})();
