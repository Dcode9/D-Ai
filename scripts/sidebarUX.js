(function () {
  const MOBILE_QUERY = '(max-width: 640px)';
  const MIN_SWIPE = 60;
  const MAX_VERTICAL_DRIFT = 42;

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

    if (!panel || !chat || !main || typeof setHistoryOpen !== 'function') {
      return null;
    }

    let searchMode = false;
    let bound = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let trackingTouch = false;

    const setSearchMode = (next) => {
      searchMode = Boolean(next);
      panel.classList.toggle('search-open', searchMode);
      if (!searchMode && searchInput) searchInput.value = '';
      if (typeof onSearchModeChange === 'function') onSearchModeChange(searchMode);
    };

    const sync = (open) => {
      if (!mobileMq.matches) {
        document.body.classList.remove('sidebar-shifted');
        return;
      }
      document.body.classList.toggle('sidebar-shifted', Boolean(open));
    };

    const toggleSearchMode = () => {
      const next = !searchMode;
      setSearchMode(next);
      if (next) {
        setHistoryOpen(true);
        requestAnimationFrame(() => searchInput?.focus());
      }
    };

    const handleTouchStart = (event) => {
      if (!mobileMq.matches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      trackingTouch = true;
    };

    const handleTouchEnd = (event) => {
      if (!trackingTouch || !mobileMq.matches || event.changedTouches.length !== 1) return;
      trackingTouch = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dy) > MAX_VERTICAL_DRIFT || Math.abs(dx) < MIN_SWIPE) return;

      const openNow = typeof isOpen === 'function' ? isOpen() : panel.classList.contains('open');
      const startedAtEdge = touchStartX <= 36;

      if (!openNow && (dx < -MIN_SWIPE || (dx > MIN_SWIPE && startedAtEdge))) {
        setHistoryOpen(true);
      } else if (openNow && dx > MIN_SWIPE) {
        setHistoryOpen(false);
      }
    };

    const bind = () => {
      if (bound) return;
      bound = true;
      [chat, main, backdrop].filter(Boolean).forEach((target) => {
        target.addEventListener('touchstart', handleTouchStart, { passive: true });
        target.addEventListener('touchend', handleTouchEnd, { passive: true });
      });
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
