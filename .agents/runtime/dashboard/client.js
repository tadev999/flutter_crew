'use strict';

const { escapeHtml } = require('./format');

/** Browser-side behaviour: fold/filter/search requirements and auto-refresh. */
function clientScript({ status }) {
  const safeStatus = escapeHtml(status);
  return `
    let currentFilter = 'all';
    let currentSearch = '';
    let autoRefreshTimer = null;

    function toggleAllReqs(open) {
      document.querySelectorAll('.req-card').forEach(function(card) {
        card.open = open;
      });
    }

    function applyFilters() {
      const cards = document.querySelectorAll('.req-card');
      let visibleCount = 0;
      cards.forEach(function(card) {
        const matchesStatus = (currentFilter === 'all') || (card.getAttribute('data-status') === currentFilter);
        const text = card.textContent.toLowerCase();
        const matchesSearch = !currentSearch || text.includes(currentSearch);
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
      currentSearch = query.toLowerCase().trim();
      applyFilters();
    }

    function toggleAutoRefresh(enabled) {
      if (enabled) {
        if (!autoRefreshTimer) {
          autoRefreshTimer = setInterval(function() {
            location.reload();
          }, 3000);
        }
      } else {
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = null;
        }
      }
    }

    // Initialize auto-refresh if in progress
    (function init() {
      const status = "${safeStatus}";
      const checkbox = document.getElementById('autoRefreshToggle');
      if (status === 'done') {
        if (checkbox) checkbox.checked = false;
      } else {
        toggleAutoRefresh(true);
      }
      const timeElem = document.getElementById('lastUpdatedText');
      if (timeElem) {
        timeElem.textContent = 'Updated at ' + new Date().toLocaleTimeString();
      }
    })();
`;
}

module.exports = { clientScript };
