/* ═══════════════════════════════════════════════════════════════════
   LibraFind — script.js
   Client-side logic: live search, filtering, issue/return flow
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ── DOM refs ────────────────────────────────────────────────────── */
  const searchInput   = document.getElementById('search-input');
  const clearBtn      = document.getElementById('clear-btn');
  const booksGrid     = document.getElementById('books-grid');
  const emptyState    = document.getElementById('empty-state');
  const loadingState  = document.getElementById('loading-state');
  const resultCount   = document.getElementById('result-count');
  const filterPills   = document.querySelectorAll('.pill[data-filter]');
  const issueModal    = document.getElementById('issue-modal');
  const issueClose    = document.getElementById('issue-modal-close');
  const issueCancelBtn = document.getElementById('issue-cancel-btn');
  const issueConfirmBtn = document.getElementById('issue-confirm-btn');
  const issueBookTitle = document.getElementById('issue-modal-book');
  const studentIdInput = document.getElementById('student-id-input');
  const toastContainer = document.getElementById('toast-container');

  /* ── State ───────────────────────────────────────────────────────── */
  let allBooks = [];
  let activeFilter = 'all';      // 'all' | 'available' | 'checked-out'
  let debounceTimer = null;
  let issueBookId = null;

  /* ── Init ────────────────────────────────────────────────────────── */
  fetchBooks();

  /* ── Event Listeners ─────────────────────────────────────────────── */
  searchInput.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !searchInput.value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchBooks(searchInput.value.trim()), 250);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    fetchBooks();
    searchInput.focus();
  });

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      renderBooks();
    });
  });

  // Modal controls
  issueClose.addEventListener('click', closeIssueModal);
  issueCancelBtn.addEventListener('click', closeIssueModal);
  issueModal.addEventListener('click', (e) => {
    if (e.target === issueModal) closeIssueModal();
  });
  issueConfirmBtn.addEventListener('click', confirmIssue);

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !issueModal.classList.contains('hidden')) {
      closeIssueModal();
    }
  });

  // Enter to confirm in modal
  studentIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmIssue();
  });

  /* ── Fetch books from API ────────────────────────────────────────── */
  async function fetchBooks(query = '') {
    try {
      showLoading(true);
      const url = query
        ? `/api/books?search=${encodeURIComponent(query)}`
        : '/api/books';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        allBooks = data.books;
        renderBooks();
      } else {
        toast('Failed to load books', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Unable to connect to the server', 'error');
    } finally {
      showLoading(false);
    }
  }

  /* ── Render book cards ───────────────────────────────────────────── */
  function renderBooks() {
    let filtered = allBooks;

    if (activeFilter === 'available') {
      filtered = allBooks.filter((b) => b.is_available);
    } else if (activeFilter === 'checked-out') {
      filtered = allBooks.filter((b) => !b.is_available);
    }

    // Update count
    const total = allBooks.length;
    const shown = filtered.length;
    resultCount.textContent = shown === total
      ? `${total} book${total !== 1 ? 's' : ''}`
      : `${shown} of ${total} book${total !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
      booksGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    booksGrid.innerHTML = filtered.map((book, i) => cardHTML(book, i)).join('');

    // Attach card button listeners
    booksGrid.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', handleCardAction);
    });
  }

  /* ── Card HTML template ──────────────────────────────────────────── */
  function cardHTML(book, index) {
    const available = Boolean(book.is_available);
    const badgeClass = available ? 'badge-available' : 'badge-checked-out';
    const badgeText  = available ? 'Present on Shelf' : 'Checked Out';

    // Parse rack location into segments for visual flair
    const locSegments = book.rack_location.split(',').map((s) => s.trim());

    return `
      <article class="book-card" style="--i:${index}" id="book-card-${book.id}">
        <div class="card-header">
          <div>
            <div class="book-title">${esc(book.title)}</div>
            <div class="book-author">by ${esc(book.author)}</div>
            <div class="book-isbn">ISBN ${esc(book.isbn)}</div>
          </div>
          <span class="badge ${badgeClass}">
            <span class="badge-dot"></span>
            ${badgeText}
          </span>
        </div>

        <div class="rack-location">
          <span class="loc-icon">📍</span>
          <div class="loc-details">
            <span class="loc-label">Shelf Location</span>
            <span class="loc-value">${esc(book.rack_location)}</span>
          </div>
        </div>

        <div class="card-actions">
          ${available
            ? `<button class="btn btn-issue" data-action="issue" data-id="${book.id}" data-title="${esc(book.title)}" id="issue-btn-${book.id}">📤 Issue Book</button>`
            : `<button class="btn btn-return" data-action="return" data-id="${book.id}" data-title="${esc(book.title)}" id="return-btn-${book.id}">📥 Return Book</button>`
          }
        </div>
      </article>
    `;
  }

  /* ── Card action handler ─────────────────────────────────────────── */
  function handleCardAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const bookId = Number(btn.dataset.id);
    const title  = btn.dataset.title;

    if (action === 'issue') {
      openIssueModal(bookId, title);
    } else if (action === 'return') {
      returnBook(bookId);
    }
  }

  /* ── Issue flow ──────────────────────────────────────────────────── */
  function openIssueModal(bookId, title) {
    issueBookId = bookId;
    issueBookTitle.textContent = title;
    studentIdInput.value = '';
    issueModal.classList.remove('hidden');
    setTimeout(() => studentIdInput.focus(), 100);
  }

  function closeIssueModal() {
    issueModal.classList.add('hidden');
    issueBookId = null;
  }

  async function confirmIssue() {
    const studentId = studentIdInput.value.trim();
    if (!studentId) {
      toast('Please enter a Student ID', 'error');
      studentIdInput.focus();
      return;
    }

    issueConfirmBtn.disabled = true;
    issueConfirmBtn.textContent = 'Processing…';

    try {
      const res = await fetch('/api/books/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: issueBookId, studentId }),
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, 'success');
        closeIssueModal();
        await fetchBooks(searchInput.value.trim());
      } else {
        toast(data.message || 'Issue failed', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Network error — could not issue book', 'error');
    } finally {
      issueConfirmBtn.disabled = false;
      issueConfirmBtn.textContent = 'Confirm Issue';
    }
  }

  /* ── Return flow ─────────────────────────────────────────────────── */
  async function returnBook(bookId) {
    try {
      const res = await fetch('/api/books/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, 'success');
        await fetchBooks(searchInput.value.trim());
      } else {
        toast(data.message || 'Return failed', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Network error — could not return book', 'error');
    }
  }

  /* ── Toast notifications ─────────────────────────────────────────── */
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-exit');
      el.addEventListener('animationend', () => el.remove());
    }, 3500);
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function showLoading(show) {
    loadingState.classList.toggle('hidden', !show);
    if (show) {
      booksGrid.innerHTML = '';
      emptyState.classList.add('hidden');
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
