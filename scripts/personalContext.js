(function () {
  const STORAGE_KEY = 'dai_personal_memory_v1';
  const THEME_KEY = 'dai_theme_mode';

  // --- Theme Management (Light/Dark) ---
  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function setTheme(mode, notify = false) {
    const isLight = mode === 'light';
    try {
      localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    } catch (e) {}
    
    document.documentElement.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('light-theme', isLight);
    
    // Update theme toggle icons across UI
    const themeBtns = document.querySelectorAll('.theme-toggle-btn');
    themeBtns.forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isLight ? 'fa-solid fa-sun text-amber-500' : 'fa-solid fa-moon text-indigo-400';
      }
      btn.title = isLight ? 'Switch to Dark Mode (Ctrl+Theme)' : 'Switch to Light Mode (Ctrl+Theme)';
    });

    // Update meta theme-color tag for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isLight ? '#f8fafc' : '#050505');
    }

    if (notify && window.showToast) {
      window.showToast(isLight ? '☀️ Switched to Light Mode' : '🌙 Switched to Dark Mode', 'fa-solid fa-circle-half-stroke text-sky-400');
    }
  }

  function toggleTheme() {
    const current = getStoredTheme();
    setTheme(current === 'light' ? 'dark' : 'light', true);
  }

  // Initialize theme on load (silently without toast)
  if (typeof document !== 'undefined') {
    const initTheme = getStoredTheme();
    document.documentElement.classList.toggle('light-theme', initTheme === 'light');
    if (document.body) {
      document.body.classList.toggle('light-theme', initTheme === 'light');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTheme(getStoredTheme(), false);
  });

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
      window.showToast('All personal memory cleared', 'fa-solid fa-trash-can text-rose-400');
    }
  }

  // Detect and extract potential memory facts from natural conversation
  function extractImplicitMemory(userText) {
    if (!userText || typeof userText !== 'string') return;
    const text = userText.trim();
    if (text.length < 5 || text.length > 250) return;

    // Direct assertions
    const nameMatch = text.match(/(?:my name is|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch && nameMatch[1] && !['A', 'The', 'User', 'Here', 'Just', 'Going'].includes(nameMatch[1])) {
      addMemoryItem(`User's name is ${nameMatch[1]}`);
    }

    const gradeMatch = text.match(/(?:i am in|i'm in|studying in|class)\s+(\d{1,2}(?:th|st|nd|rd)?\s*(?:grade|class|standard)?)/i);
    if (gradeMatch && gradeMatch[1]) {
      addMemoryItem(`User is studying in ${gradeMatch[1]}`);
    }

    const goalMatch = text.match(/(?:my goal is to|i want to become|i am preparing for)\s+([^.!?\n]+)/i);
    if (goalMatch && goalMatch[1]) {
      addMemoryItem(`User's goal/prep: ${goalMatch[1].trim()}`);
    }

    const techMatch = text.match(/(?:i code in|i build with|my stack is|i work as a)\s+([^.!?\n]+)/i);
    if (techMatch && techMatch[1]) {
      addMemoryItem(`User works/studies ${techMatch[1].trim()}`);
    }
  }

  // Generate Personalized Hero Prompt Chips based on Memory Context
  function getContextualHeroPrompts() {
    const memory = getMemory();
    const prompts = [];
    const usedQueries = new Set();

    // 1. Process user memories
    memory.forEach((fact) => {
      const f = fact.trim();
      const fLower = f.toLowerCase();
      if (!f || prompts.length >= 4) return;

      if (fLower.includes('name is') || fLower.includes('my name') || fLower.includes('dhairya')) {
        const nameMatch = f.match(/name (?:is )?([a-zA-Z]+)/i) || [null, 'Dhairya'];
        const userName = nameMatch[1] || 'Dhairya';
        const p = {
          title: `👋 Daily Goal for ${userName}`,
          desc: "Personalized morning motivation & learning goal",
          query: `Hey D'Ai! Give me a personalized daily learning quote, focus goal, and tip for ${userName}.`
        };
        if (!usedQueries.has(p.query)) {
          usedQueries.add(p.query);
          prompts.push(p);
        }
      } else if (fLower.includes('10th') || fLower.includes('grade') || fLower.includes('class') || fLower.includes('school') || fLower.includes('exam')) {
        const p = {
          title: "📚 Key Concept Cheatsheet",
          desc: `High-yield study summary: "${f.slice(0, 26)}"`,
          query: `Create a clean study cheatsheet and formula summary tailored to: ${f}.`
        };
        if (!usedQueries.has(p.query)) {
          usedQueries.add(p.query);
          prompts.push(p);
        }
      } else if (fLower.includes('python') || fLower.includes('rust') || fLower.includes('javascript') || fLower.includes('code') || fLower.includes('developer') || fLower.includes('engineer') || fLower.includes('react')) {
        const p = {
          title: "💻 Interactive Code Template",
          desc: `Clean script architecture: "${f.slice(0, 26)}"`,
          query: `Write a clean, modular code template with live preview and explanations tailored to: ${f}.`
        };
        if (!usedQueries.has(p.query)) {
          usedQueries.add(p.query);
          prompts.push(p);
        }
      } else {
        const p = {
          title: `🧠 Explore "${f.slice(0, 22)}${f.length > 22 ? '...' : ''}"`,
          desc: "Deep dive tailored to your saved context",
          query: `Tell me something fascinating, actionable, and deep based on my context: "${f}".`
        };
        if (!usedQueries.has(p.query)) {
          usedQueries.add(p.query);
          prompts.push(p);
        }
      }
    });

    // 2. High quality default prompts to ensure always 4
    const defaults = [
      {
        title: "⚡ Quantum Computing",
        desc: "Explain superposition & qubits simply",
        query: "Explain quantum computing and superposition in simple terms."
      },
      {
        title: "🎨 Surreal Wallpaper",
        desc: "Generate futuristic neon city wallpaper",
        query: "Generate a surreal futuristic neon city wallpaper with vibrant lights."
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
      if (prompts.length < 4 && !usedQueries.has(d.query)) {
        usedQueries.add(d.query);
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
          <div class="text-center py-6 text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
            <i class="fa-solid fa-brain text-gray-600 text-lg mb-1 block"></i>
            No facts stored yet. Add things you want D'Ai to always remember!
          </div>
        `;
        return;
      }

      listEl.innerHTML = items.map((item, idx) => `
        <div class="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0"></span>
            <span class="text-xs text-gray-200 truncate">${item.replace(/[<>&"]/g, '')}</span>
          </div>
          <button data-remove-idx="${idx}" class="w-7 h-7 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center text-xs transition-colors cursor-pointer flex-shrink-0" title="Remove fact">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-remove-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = Number(btn.getAttribute('data-remove-idx'));
          removeMemoryItem(idx);
          updateListUI();
        });
      });
    }

    updateListUI();
    modal.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => modal.querySelector('#memory-add-input')?.focus(), 100);
  }

  window.toggleTheme = toggleTheme;
  window.setTheme = setTheme;
  window.getStoredTheme = getStoredTheme;
  window.getPersonalContextFacts = getMemory;
  window.addPersonalContextFact = addMemoryItem;
  window.removePersonalContextFact = removeMemoryItem;
  window.clearPersonalContextMemory = clearMemory;
  window.extractImplicitMemory = extractImplicitMemory;
  window.getContextualHeroPrompts = getContextualHeroPrompts;
  window.openPersonalContextModal = renderPersonalContextModal;
  window.closePersonalContextModal = () => {
    const modal = document.getElementById('personal-context-modal');
    if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
  };
})();
