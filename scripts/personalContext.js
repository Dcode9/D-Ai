(function () {
  const STORAGE_KEY = 'dai_personal_memory_v1';
  const THEME_KEY = 'dai_theme_mode';

  // --- Theme Management (Light/Dark) ---
  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  function setTheme(mode) {
    const isLight = mode === 'light';
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    document.documentElement.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('light-theme', isLight);
    
    // Update theme toggle icons across UI
    const themeBtns = document.querySelectorAll('.theme-toggle-btn');
    themeBtns.forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isLight ? 'fa-solid fa-sun text-amber-400' : 'fa-solid fa-moon text-indigo-400';
      }
      btn.title = isLight ? 'Switch to Dark Mode (Ctrl+Theme)' : 'Switch to Light Mode (Ctrl+Theme)';
    });

    if (window.showToast) {
      window.showToast(isLight ? '☀️ Switched to Light Mode' : '🌙 Switched to Dark Mode', 'fa-solid fa-circle-half-stroke text-sky-400');
    }
  }

  function toggleTheme() {
    const current = getStoredTheme();
    setTheme(current === 'light' ? 'dark' : 'light');
  }

  // Initialize theme on load
  document.addEventListener('DOMContentLoaded', () => {
    setTheme(getStoredTheme());
  });
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('light-theme', getStoredTheme() === 'light');
  }

  // --- Personal Context / Memory System ---
  function getMemory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveMemory(list) {
    try {
      const cleanList = Array.from(new Set((list || []).map(s => String(s).trim()).filter(Boolean)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList));
      window.dispatchEvent(new CustomEvent('dai:memory-updated', { detail: cleanList }));
      
      // Update memory indicator badge in settings
      const memoryBadge = document.getElementById('memory-count-badge');
      if (memoryBadge) {
        memoryBadge.textContent = cleanList.length;
        memoryBadge.classList.toggle('hidden', cleanList.length === 0);
      }
      return cleanList;
    } catch (e) {
      return list;
    }
  }

  function addMemoryItem(item) {
    if (!item || typeof item !== 'string') return;
    const cleanItem = item.trim();
    if (!cleanItem) return;
    const current = getMemory();
    if (!current.includes(cleanItem)) {
      current.push(cleanItem);
      saveMemory(current);
      if (window.showToast) {
        window.showToast(`🧠 Saved fact: "${cleanItem.slice(0, 32)}${cleanItem.length > 32 ? '...' : ''}"`, 'fa-solid fa-brain text-purple-400');
      }
    }
  }

  function removeMemoryItem(index) {
    const current = getMemory();
    if (index >= 0 && index < current.length) {
      current.splice(index, 1);
      saveMemory(current);
      if (window.showToast) {
        window.showToast('Fact removed from memory', 'fa-solid fa-trash-can text-rose-400');
      }
    }
  }

  function clearMemory() {
    saveMemory([]);
    if (window.showToast) {
      window.showToast('Cleared all stored personal memory', 'fa-solid fa-eraser text-amber-400');
    }
  }

  // Auto-Extract Facts from User Input & AI Responses
  function processTextForFacts(userText, aiResponseText) {
    // 1. Check for AI's explicit [MEMORY_UPDATE: {"add": [...]}] tag
    if (aiResponseText) {
      const match = aiResponseText.match(/\[MEMORY_UPDATE:\s*(\{[\s\S]*?\})\]/);
      if (match) {
        try {
          const payload = JSON.parse(match[1]);
          if (payload.add && Array.isArray(payload.add)) {
            payload.add.forEach(fact => addMemoryItem(fact));
          }
        } catch (e) {}
      }
    }

    if (!userText) return;
    const text = userText.trim();
    const lower = text.toLowerCase();
    
    // Explicit name checks
    if (lower.includes('dhairya')) {
      addMemoryItem("User's name is Dhairya");
    } else {
      const nameMatch = text.match(/(?:my name is|i'm|i am|call me|myself|name is)\s+([A-Z][a-zA-Z]+)/i);
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        const ignoreWords = ['here', 'student', 'developer', 'learning', 'trying', 'asking', 'wondering', 'ready'];
        if (!ignoreWords.includes(name.toLowerCase())) {
          addMemoryItem(`User's name is ${name}`);
        }
      }
    }

    // Standard / Grade checks
    const gradeMatch = text.match(/\b(10th|11th|12th|9th|8th|7th|6th|5th|class\s*\d+|standard\s*\d+|\d+th\s+standard|\d+th\s+grade|grade\s*\d+)\b/i);
    if (gradeMatch && gradeMatch[1]) {
      addMemoryItem(`User studies in ${gradeMatch[1]}`);
    } else if (lower.includes('10th') || lower.includes('class 10') || lower.includes('standard 10')) {
      addMemoryItem("User studies in 10th standard");
    }

    // Tech / Subject interests
    const techMatch = text.match(/\b(python|javascript|typescript|react|express|node|flutter|c\+\+|java|rust|physics|maths?|chemistry)\b/i);
    if (techMatch && techMatch[1] && (lower.includes('use') || lower.includes('learn') || lower.includes('code') || lower.includes('study') || lower.includes('subject'))) {
      addMemoryItem(`User works/studies ${techMatch[1]}`);
    }
  }

  // Generate Personalized Hero Prompt Chips based on Memory Context
  function getContextualHeroPrompts() {
    const memory = getMemory();
    const memStr = memory.join(' ').toLowerCase();

    const prompts = [];

    // Personalization rules
    if (memStr.includes('dhairya') || memStr.includes('user\'s name')) {
      prompts.push({
        title: "👋 Personal Greeting",
        desc: "Get a personalized daily learning goal & quote",
        query: "Hey D'Ai! Give me a quick personalized daily learning quote and goal for Dhairya."
      });
    }

    if (memStr.includes('10th') || memStr.includes('class 10') || memStr.includes('standard')) {
      prompts.push({
        title: "📚 10th Grade Study Notes",
        desc: "Physics & Chemistry key formulas & summary",
        query: "Create a clean 10th grade Physics formula cheatsheet with key concepts."
      });
      prompts.push({
        title: "📐 Math Quadratic Solver",
        desc: "Step-by-step quadratic equations & geometry",
        query: "Explain how to solve quadratic equations step-by-step with examples for 10th grade."
      });
    }

    if (memStr.includes('python') || memStr.includes('code') || memStr.includes('developer')) {
      prompts.push({
        title: "🐍 Python Script Generator",
        desc: "Fast Python automation script",
        query: "Write a clean Python script using asyncio and httpx to fetch API data."
      });
    }

    if (memStr.includes('react') || memStr.includes('typescript') || memStr.includes('web')) {
      prompts.push({
        title: "💻 React Component Studio",
        desc: "Interactive UI widget preview",
        query: "Create an interactive HTML/Tailwind CSS dashboard widget with code."
      });
    }

    // Fill defaults if less than 4
    const defaults = [
      {
        title: "⚡ Quantum Computing",
        desc: "Explain superposition & qubits simply",
        query: "Explain quantum computing and superposition in simple terms."
      },
      {
        title: "🎨 Surreal Wallpaper",
        desc: "Generate futuristic neon city wallpaper",
        query: "Generate a surreal futuristic neon city wallpaper."
      },
      {
        title: "📊 Interactive Math Graph",
        desc: "Pythagorean theorem with visual demo",
        query: "Visualize the Pythagorean theorem with an interactive HTML canvas."
      },
      {
        title: "🚀 Express TypeScript API",
        desc: "REST API starter architecture",
        query: "Create a REST API structure using Express and TypeScript."
      }
    ];

    defaults.forEach(d => {
      if (prompts.length < 4 && !prompts.some(p => p.title === d.title)) {
        prompts.push(d);
      }
    });

    return prompts.slice(0, 4);
  }

  // --- UI Modal for Memory Management ---
  function renderPersonalContextModal() {
    let modal = document.getElementById('personal-context-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'personal-context-modal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md opacity-0 pointer-events-none transition-opacity duration-200 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]';
      
      modal.innerHTML = `
        <div class="w-full max-w-lg bg-[#0e1017] border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]">
          <div class="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
            <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 text-xs sm:text-sm flex-shrink-0">
                <i class="fa-solid fa-brain"></i>
              </div>
              <div class="min-w-0">
                <h3 class="text-xs sm:text-sm font-bold text-white tracking-wide truncate">Personal Context & Memory</h3>
                <p class="text-[10px] sm:text-[11px] text-gray-400 truncate">Facts D'Ai remembers to tailor your answers</p>
              </div>
            </div>
            <button id="memory-modal-close" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors flex-shrink-0 cursor-pointer" title="Close (Esc)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-3 sm:space-y-4 -webkit-overflow-scrolling-touch">
            <div class="flex gap-2">
              <input id="memory-add-input" type="text" placeholder="Add a fact (e.g., 'My name is Dhairya')" class="flex-1 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50">
              <button id="memory-add-btn" class="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/20 hover:bg-purple-500/30 text-xs font-semibold text-purple-300 transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0" title="Add Fact">
                <i class="fa-solid fa-plus"></i> <span>Add</span>
              </button>
            </div>

            <div id="memory-items-list" class="space-y-2"></div>
          </div>

          <div class="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] sm:text-xs">
            <button id="memory-clear-btn" class="text-rose-400 hover:text-rose-300 hover:underline cursor-pointer">Clear all memory</button>
            <span class="text-gray-500 text-[10px] sm:text-[11px]"><i class="fa-solid fa-sparkles text-purple-400 mr-1"></i>Auto-saved</span>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#memory-modal-close').addEventListener('click', () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('opacity-0', 'pointer-events-none');
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('opacity-0')) {
          modal.classList.add('opacity-0', 'pointer-events-none');
        }
      });

      const addInput = modal.querySelector('#memory-add-input');
      const addBtn = modal.querySelector('#memory-add-btn');

      const handleAdd = () => {
        const val = addInput.value.trim();
        if (val) {
          addMemoryItem(val);
          addInput.value = '';
          updateListUI();
        }
      };

      addBtn.addEventListener('click', handleAdd);
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAdd(); });

      modal.querySelector('#memory-clear-btn').addEventListener('click', () => {
        if (confirm('Clear all stored personal memory?')) {
          clearMemory();
          updateListUI();
        }
      });
    }

    function updateListUI() {
      const listEl = modal.querySelector('#memory-items-list');
      const items = getMemory();
      if (!items.length) {
        listEl.innerHTML = `
          <div class="p-6 border border-dashed border-white/10 rounded-xl text-center">
            <div class="text-purple-400 text-lg mb-1"><i class="fa-solid fa-brain opacity-60"></i></div>
            <p class="text-xs text-gray-300 font-medium">No personal facts remembered yet.</p>
            <p class="text-[11px] text-gray-500 mt-0.5">Tell D'Ai your name, grade, or interests and it will remember automatically!</p>
          </div>
        `;
        return;
      }
      listEl.innerHTML = items.map((item, idx) => `
        <div class="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-xs text-gray-200 group">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span>${escapeHtml(item)}</span>
          </div>
          <button data-memory-delete="${idx}" class="text-gray-500 hover:text-rose-400 text-xs transition-colors p-1 opacity-80 group-hover:opacity-100" title="Delete memory">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-memory-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-memory-delete'), 10);
          removeMemoryItem(idx);
          updateListUI();
        });
      });
    }

    updateListUI();
    modal.classList.remove('opacity-0', 'pointer-events-none');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Global Exports
  window.getPersonalContext = getMemory;
  window.getPersonalContextFacts = getMemory;
  window.savePersonalContext = saveMemory;
  window.addPersonalMemoryItem = addMemoryItem;
  window.processTextForFacts = processTextForFacts;
  window.getContextualHeroPrompts = getContextualHeroPrompts;
  window.openPersonalContextModal = renderPersonalContextModal;
  window.toggleTheme = toggleTheme;
  window.setTheme = setTheme;
  window.getStoredTheme = getStoredTheme;
})();
