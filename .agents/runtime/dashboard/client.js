'use strict';

/** Browser-side behaviour: fold/filter/search requirements and auto-refresh. */
function clientScript() {
  return `
    let currentFilter = 'all';
    let currentSearch = '';
    let autoRefreshTimer = null;
    let reloadPending = false;
    let storageWarningShown = false;
    let copyingCommand = false;
    let progressStarts = {};
    const storageKey = 'fluttercrew-dashboard:' + location.pathname;
    const runKey = document.body.dataset.runKey;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    history.scrollRestoration = 'manual';

    function storageWarning(error) {
      if (!storageWarningShown) console.warn('Dashboard preferences unavailable; refresh may reset the view.', error);
      storageWarningShown = true;
    }

    function readPreferences() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        return saved && saved.runKey === runKey ? saved : null;
      } catch (error) {
        storageWarning(error);
        return null;
      }
    }

    function savePreferences() {
      const values = {};
      document.querySelectorAll('[data-motion-key]').forEach(function(element) {
        values[element.dataset.motionKey] = element.dataset.motionValue;
      });
      const disclosures = {};
      document.querySelectorAll('details').forEach(function(card) {
        disclosures[card.dataset.id || card.id] = card.open;
      });
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          runKey, values, disclosures, filter: currentFilter, search: currentSearch,
          scrollY: window.scrollY, focusId: document.activeElement?.id,
          autoRefresh: document.getElementById('autoRefreshToggle').checked,
          progressStarts
        }));
      } catch (error) { storageWarning(error); }
    }

    function animateChanges(saved) {
      if (reducedMotion.matches) return;
      const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
      document.querySelectorAll('[data-motion-key]').forEach(function(element, index) {
        const previous = saved?.values?.[element.dataset.motionKey];
        if (saved && previous !== element.dataset.motionValue) {
          element.classList.add('is-updated');
        } else if (!saved && !isReload) {
          element.style.setProperty('--enter-delay', Math.min(index, 6) * 35 + 'ms');
          element.classList.add('is-entering');
        }
      });
    }

    function restoreProgress(saved) {
      const now = Date.now();
      progressStarts = {};
      document.querySelectorAll('[data-progress-key]').forEach(function(element) {
        const key = element.dataset.progressKey;
        const previous = saved?.progressStarts?.[key];
        const start = Number.isFinite(previous) && previous <= now ? previous : now;
        progressStarts[key] = start;
        element.style.setProperty('--progress-offset', '-' + ((now - start) % 2400) + 'ms');
      });
    }

    function animateDisclosure(card) {
      card.classList.add('is-user-toggled');
      setTimeout(function() { card.classList.remove('is-user-toggled'); }, 250);
    }

    function toggleAllReqs(open) {
      document.querySelectorAll('.req-card').forEach(function(card) {
        if (card.open !== open) animateDisclosure(card);
        card.open = open;
      });
    }

    function applyFilters() {
      const cards = document.querySelectorAll('.req-card');
      let visibleCount = 0;
      cards.forEach(function(card) {
        const matchesStatus = (currentFilter === 'all') || (card.getAttribute('data-status') === currentFilter);
        const text = card.textContent.toLowerCase();
        const matchesSearch = !currentSearch.trim() || text.includes(currentSearch.toLowerCase().trim());
        if (matchesStatus && matchesSearch) {
          card.style.display = 'block';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });
      const emptyMsg = document.getElementById('reqEmptyMsg');
      if (emptyMsg) {
        emptyMsg.style.display = (visibleCount === 0 && cards.length > 0) ? 'block' : 'none';
      }
    }

    function filterReqs(status, btn) {
      document.querySelectorAll('.filter-chip').forEach(function(c) {
        c.classList.remove('active');
      });
      btn.classList.add('active');
      currentFilter = status;
      applyFilters();
    }

    function searchReqs(query) {
      currentSearch = query;
      applyFilters();
    }

    function focusRequirementWork(id) {
      const card = document.getElementById(id);
      if (!card) { console.warn('Unknown requirement:', id); return; }
      currentSearch = '';
      document.getElementById('requirement-search').value = '';
      const all = document.getElementById('filter-all');
      filterReqs('all', all);
      card.open = true;
      card.querySelector('summary').focus({ preventScroll: true });
      savePreferences();
    }

    function openActionDestination(id) {
      const destination = document.getElementById(id);
      if (!destination) { console.warn('Unknown action destination:', id); return; }
      if (destination.tagName === 'DETAILS') destination.open = true;
      destination.querySelectorAll('details').forEach(function(details) { details.open = true; });
    }

    async function copyPrimaryCommand(button = document.getElementById('copy-command')) {
      if (copyingCommand) return;
      const feedback = document.getElementById('copy-feedback');
      const fallback = document.getElementById('manual-copy');
      copyingCommand = true;
      button.disabled = true;
      feedback.textContent = 'Copying command...';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');
        await navigator.clipboard.writeText(button.dataset.command);
        fallback.hidden = true;
        button.textContent = 'Copied';
        feedback.textContent = 'Command copied. Run it in your project terminal; nothing was executed here.';
      } catch (error) {
        console.warn('Could not copy dashboard command:', error);
        fallback.hidden = false;
        const input = document.getElementById('manual-command');
        input.value = button.dataset.command;
        fallback.scrollIntoView({ block: 'nearest' });
        input.focus();
        input.select();
        feedback.textContent = 'Clipboard unavailable. Copy the selected command below; nothing was executed here.';
      } finally {
        copyingCommand = false;
        button.disabled = false;
      }
    }

    function toggleAutoRefresh(enabled) {
      document.getElementById('autoRefreshToggle').checked = enabled;
      if (enabled) {
        if (!autoRefreshTimer) {
          autoRefreshTimer = setInterval(function() {
            if (!copyingCommand && !document.activeElement?.matches('input:not([type="checkbox"]), textarea, select')) {
              refreshDashboardPage();
            }
          }, 3000);
        }
      } else {
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = null;
        }
      }
      savePreferences();
    }

    function refreshDashboardPage() {
      if (reloadPending) return;
      reloadPending = true;
      savePreferences();
      document.getElementById('refreshButton').classList.add('is-refreshing');
      setTimeout(function() { location.reload(); }, reducedMotion.matches ? 0 : 140);
    }

    (function init() {
      const saved = readPreferences();
      if (saved) {
        currentFilter = ['all', 'passed', 'pending', 'stale', 'blocked'].includes(saved.filter) ? saved.filter : 'all';
        currentSearch = typeof saved.search === 'string' ? saved.search : '';
        document.getElementById('requirement-search').value = currentSearch;
        document.querySelectorAll('.filter-chip').forEach(function(chip) {
          chip.classList.toggle('active', chip.dataset.filter === currentFilter);
        });
        document.querySelectorAll('details').forEach(function(card) {
          const open = saved.disclosures?.[card.dataset.id || card.id];
          if (typeof open === 'boolean') card.open = open;
        });
        applyFilters();
        if (saved.focusId) document.getElementById(saved.focusId)?.focus({ preventScroll: true });
        if (Number.isFinite(saved.scrollY)) {
          window.scrollTo(0, saved.scrollY);
          window.addEventListener('pageshow', function() { window.scrollTo(0, saved.scrollY); }, { once: true });
        }
      }
      document.querySelectorAll('.req-summary').forEach(function(summary) {
        summary.addEventListener('click', function() { animateDisclosure(summary.parentElement); });
      });
      animateChanges(saved);
      restoreProgress(saved);
      toggleAutoRefresh(saved?.autoRefresh !== false);
      window.addEventListener('beforeunload', savePreferences);
      const timeElem = document.getElementById('lastUpdatedText');
      if (timeElem) {
        timeElem.textContent = 'Updated at ' + new Date().toLocaleTimeString();
      }
    })();
`;
}

module.exports = { clientScript };
