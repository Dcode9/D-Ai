(function () {
  const MOBILE_QUERY = '(max-width: 640px)';
  const MIN_SWIPE = 45;

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
        return;
      }
      document.body.classList.remove('desktop-sidebar-open');
      document.body.classList.toggle('sidebar-shifted', Boolean(open));
      document.body.style.removeProperty('--swipe-shift');
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
      document.body.style.setProperty('--swipe-shift', `${Math.round(shiftPx)}px`);
      if (backdrop) {
        const opacity = Math.min(1, Math.max(0, shiftPx / 285));
        backdrop.style.opacity = String(opacity);
        if (shiftPx > 0) backdrop.classList.remove('hidden');
      }
    };

    const resetSwipeShift = () => {
      document.body.style.removeProperty('--swipe-shift');
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
      const openNow = typeof isOpen === 'function' ? isOpen() : panel.classList.contains('open');

      // If closed, only track swipe if starting from left edge (< 35px)
      if (!openNow && touch.clientX > 35) return;

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
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          lockDirection = 'v';
          trackingTouch = false;
          return;
        } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
          lockDirection = 'h';
          isSwiping = true;
        }
      }

      if (isSwiping && lockDirection === 'h') {
        const openNow = typeof isOpen === 'function' ? isOpen() : panel.classList.contains('open');
        const maxShift = Math.min(window.innerWidth * 0.85, 285);

        if (!openNow && dx > 0) {
          const shift = Math.min(dx, maxShift);
          applySwipeShift(shift);
        } else if (openNow && dx < 0) {
          const shift = Math.max(0, maxShift + dx);
          applySwipeShift(shift);
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
      const openNow = typeof isOpen === 'function' ? isOpen() : panel.classList.contains('open');

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

      mobileMq.addEventListener?.('change', () => sync(panel.classList.contains('open')));

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
