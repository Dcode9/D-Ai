(function () {
  const MOBILE_QUERY = '(max-width: 640px)';
  const MIN_SWIPE = 40;

  window.createSidebarUXController = function createSidebarUXController(options = {}) {
    const panel = options.panel;
    const chat = options.chat;
    const main = options.main;
    const backdrop = options.backdrop;
    const searchInput = options.searchInput;
    const setHistoryOpen = options.setHistoryOpen;
    const onSearchModeChange = options.onSearchModeChange;
    const isOpen = options.isOpen;
    const mobileMq = window.matchMedia(MOBILE_QUERY);

    if (!panel || typeof setHistoryOpen !== 'function') {
      return null;
    }

    let searchMode = false;
    let bound = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let currentTouchX = 0;
    let trackingTouch = false;
    let isSwiping = false;
    let lockDirection = false; // 'h' for horizontal, 'v' for vertical

    const getMaxShift = () => Math.min(window.innerWidth - 40, 310);

    const setSearchMode = (next) => {
      searchMode = Boolean(next);
      panel.classList.toggle('search-open', searchMode);
      if (!searchMode && searchInput) searchInput.value = '';
      if (typeof onSearchModeChange === 'function') onSearchModeChange(searchMode);
    };

    const sync = (open) => {
      if (!mobileMq.matches) {
        document.body.classList.remove('sidebar-shifted');
        document.body.classList.toggle('desktop-sidebar-open', Boolean(open));
        document.body.style.removeProperty('--swipe-shift');
        document.body.style.removeProperty('--swipe-ratio');
        return;
      }
      document.body.classList.remove('desktop-sidebar-open');
      document.body.classList.toggle('sidebar-shifted', Boolean(open));
      document.body.style.removeProperty('--swipe-shift');
      document.body.style.removeProperty('--swipe-ratio');
    };

    const toggleSearchMode = () => {
      const next = !searchMode;
      setSearchMode(next);
      if (next) {
        setHistoryOpen(true);
        requestAnimationFrame(() => searchInput?.focus());
      }
    };

    const applySwipeShift = (shiftPx) => {
      const maxShift = getMaxShift();
      const clamped = Math.max(0, Math.min(shiftPx, maxShift));
      const ratio = clamped / maxShift;
      document.body.style.setProperty('--swipe-shift', `${Math.round(clamped)}px`);
      document.body.style.setProperty('--swipe-ratio', ratio.toFixed(3));
      if (backdrop) {
        backdrop.style.opacity = String(Math.min(0.65, ratio * 0.65));
        if (clamped > 0) backdrop.classList.remove('hidden');
      }
    };

    const resetSwipeShift = () => {
      document.body.style.removeProperty('--swipe-shift');
      document.body.style.removeProperty('--swipe-ratio');
      if (backdrop) backdrop.style.removeProperty('opacity');
    };

    const isInteractiveElement = (el) => {
      if (!el || !el.closest) return false;
      return Boolean(el.closest('input, textarea, select, button, pre, code, .table-scroll, .math-block, .dai-chart-shell, .dai-widget, #personal-context-modal, #code-studio-drawer, #settings-menu-modal, #account-menu-modal, #chat-action-popover'));
    };

    const handleTouchStart = (event) => {
      if (!mobileMq.matches || event.touches.length !== 1) return;
      if (isInteractiveElement(event.target)) return;

      const touch = event.touches[0];
      const openNow = typeof isOpen === 'function' ? isOpen() : document.body.classList.contains('sidebar-shifted');

      // If sidebar is closed, only start swipe tracking if swiping from left edge area (< 45px)
      if (!openNow && touch.clientX > 45) return;

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      currentTouchX = touch.clientX;
      trackingTouch = true;
      isSwiping = false;
      lockDirection = false;
    };

    const handleTouchMove = (event) => {
      if (!trackingTouch || !mobileMq.matches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      currentTouchX = touch.clientX;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;

      if (!lockDirection) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
          lockDirection = 'v';
          trackingTouch = false;
          return;
        } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 7) {
          lockDirection = 'h';
          isSwiping = true;
        }
      }

      if (isSwiping && lockDirection === 'h') {
        const openNow = typeof isOpen === 'function' ? isOpen() : document.body.classList.contains('sidebar-shifted');
        const maxShift = getMaxShift();

        if (!openNow && dx > 0) {
          applySwipeShift(dx);
        } else if (openNow && dx < 0) {
          applySwipeShift(maxShift + dx);
        }
      }
    };

    const handleTouchEnd = (event) => {
      if (!trackingTouch || !mobileMq.matches) {
        resetSwipeShift();
        return;
      }
      trackingTouch = false;
      const dx = currentTouchX - touchStartX;
      const openNow = typeof isOpen === 'function' ? isOpen() : document.body.classList.contains('sidebar-shifted');

      resetSwipeShift();

      if (isSwiping && lockDirection === 'h') {
        if (!openNow && dx > MIN_SWIPE) {
          setHistoryOpen(true);
        } else if (openNow && dx < -MIN_SWIPE) {
          setHistoryOpen(false);
        }
      }
      isSwiping = false;
      lockDirection = false;
    };

    const bind = () => {
      if (bound) return;
      bound = true;

      document.body.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.body.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.body.addEventListener('touchend', handleTouchEnd, { passive: true });
      document.body.addEventListener('touchcancel', handleTouchEnd, { passive: true });

      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setHistoryOpen(false);
        });
      }

      mobileMq.addEventListener?.('change', () => sync(panel.classList.contains('open') || document.body.classList.contains('sidebar-shifted')));

      panel.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setSearchMode(false);
      });
      searchInput?.addEventListener('focus', () => setSearchMode(true));
    };

    return {
      bind,
      sync,
      setSearchMode,
      toggleSearchMode
    };
  };
})();
