/* ═══════════════════════════════════════════════════════════════════
   LibSync — script.js (Firebase Edition)
   Client-side logic: Firebase Auth, Firestore queries, live search,
   filtering, issue/return flow
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ── DOM refs — Auth ──────────────────────────────────────────────── */
  const authScreen      = document.getElementById('auth-screen');
  const appContainer    = document.getElementById('app-container');
  const loginForm       = document.getElementById('login-form');
  const signupForm      = document.getElementById('signup-form');
  const loginEmailIn    = document.getElementById('login-email');
  const loginPassIn     = document.getElementById('login-password');
  const signupEmailIn   = document.getElementById('signup-email');
  const signupPassIn    = document.getElementById('signup-password');
  const signupConfirmIn = document.getElementById('signup-confirm');
  const authError       = document.getElementById('auth-error');
  const tabLogin        = document.getElementById('tab-login');
  const tabSignup       = document.getElementById('tab-signup');
  const guestBtn        = document.getElementById('guest-btn');
  const logoutBtn       = document.getElementById('logout-btn');
  const loginPromptBtn  = document.getElementById('login-prompt-btn');
  const userBar         = document.getElementById('user-bar');
  const guestBar        = document.getElementById('guest-bar');
  const userEmailEl     = document.getElementById('user-email');

  /* ── DOM refs — App ──────────────────────────────────────────────── */
  const searchInput     = document.getElementById('search-input');
  const clearBtn        = document.getElementById('clear-btn');
  const booksGrid       = document.getElementById('books-grid');
  const emptyState      = document.getElementById('empty-state');
  const loadingState    = document.getElementById('loading-state');
  const resultCount     = document.getElementById('result-count');
  const filterPills     = document.querySelectorAll('.pill[data-filter]');
  const issueModal      = document.getElementById('issue-modal');
  const issueClose      = document.getElementById('issue-modal-close');
  const issueCancelBtn  = document.getElementById('issue-cancel-btn');
  const issueConfirmBtn = document.getElementById('issue-confirm-btn');
  const issueBookTitle  = document.getElementById('issue-modal-book');
  const studentIdInput  = document.getElementById('student-id-input');
  const toastContainer  = document.getElementById('toast-container');

  /* ── State ───────────────────────────────────────────────────────── */
  let allBooks = [];
  let activeFilter = 'all';
  let debounceTimer = null;
  let issueBookId = null;
  let currentUser = null;
  let isGuest = false;

  /* ═══════════════════════════════════════════════════════════════════
     AUTH LOGIC
     ═══════════════════════════════════════════════════════════════════ */

  /* ── Tab switching ──────────────────────────────────────────────── */
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    hideAuthError();
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    hideAuthError();
  });

  /* ── Login ──────────────────────────────────────────────────────── */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();
    const email = loginEmailIn.value.trim();
    const pass  = loginPassIn.value;

    if (!email || !pass) return showAuthError('Please fill in all fields.');

    setAuthLoading(loginForm, true);
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // onAuthStateChanged will handle the rest
    } catch (err) {
      showAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(loginForm, false);
    }
  });

  /* ── Sign Up ────────────────────────────────────────────────────── */
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();
    const email   = signupEmailIn.value.trim();
    const pass    = signupPassIn.value;
    const confirm = signupConfirmIn.value;

    if (!email || !pass || !confirm) return showAuthError('Please fill in all fields.');
    if (pass !== confirm) return showAuthError('Passwords do not match.');
    if (pass.length < 6) return showAuthError('Password must be at least 6 characters.');

    setAuthLoading(signupForm, true);
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      // onAuthStateChanged will handle the rest
    } catch (err) {
      showAuthError(friendlyAuthError(err));
    } finally {
      setAuthLoading(signupForm, false);
    }
  });

  /* ── Guest mode ─────────────────────────────────────────────────── */
  guestBtn.addEventListener('click', () => {
    isGuest = true;
    currentUser = null;
    enterApp();
  });

  /* ── Login prompt (from guest mode) ─────────────────────────────── */
  loginPromptBtn.addEventListener('click', () => {
    isGuest = false;
    appContainer.classList.add('hidden');
    authScreen.classList.remove('hidden');
  });

  /* ── Logout ─────────────────────────────────────────────────────── */
  logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
    isGuest = false;
    currentUser = null;
    appContainer.classList.add('hidden');
    authScreen.classList.remove('hidden');
  });

  /* ── Firebase Auth State Listener ───────────────────────────────── */
  auth.onAuthStateChanged((user) => {
    // If on an admin route, let the admin logic handle this
    if (window.location.pathname.startsWith('/admin')) {
      return;
    }

    if (user) {
      currentUser = user;
      isGuest = false;
      enterApp();
    } else if (!isGuest) {
      currentUser = null;
      // Show auth screen
      appContainer.classList.add('hidden');
      authScreen.classList.remove('hidden');
    }
  });

  /* ── Enter the app ──────────────────────────────────────────────── */
  function enterApp() {
    authScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');

    if (currentUser) {
      userBar.classList.remove('hidden');
      guestBar.classList.add('hidden');
      userEmailEl.textContent = currentUser.email;
    } else {
      userBar.classList.add('hidden');
      guestBar.classList.remove('hidden');
    }

    fetchBooks();
  }

  /* ── Auth helpers ───────────────────────────────────────────────── */
  function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
  }

  function hideAuthError() {
    authError.classList.add('hidden');
    authError.textContent = '';
  }

  function setAuthLoading(form, loading) {
    const btn = form.querySelector('.btn-auth');
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    text.style.opacity = loading ? '0' : '1';
    spinner.classList.toggle('hidden', !loading);
  }

  function friendlyAuthError(err) {
    const map = {
      'auth/user-not-found':         'No account found with that email.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/invalid-credential':     'Invalid email or password.',
      'auth/email-already-in-use':   'An account with that email already exists.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/too-many-requests':      'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[err.code] || `Error: ${err.message}`;
  }


  /* ═══════════════════════════════════════════════════════════════════
     LIBRARY APP LOGIC
     ═══════════════════════════════════════════════════════════════════ */

  /* ── Event Listeners ─────────────────────────────────────────────── */
  searchInput.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !searchInput.value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderBooks(), 250);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    renderBooks();
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

  /* ── Fetch books from Firestore ──────────────────────────────────── */
  async function fetchBooks() {
    try {
      showLoading(true);

      const snapshot = await db.collection('books').get();

      let booksList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort client-side to avoid requiring a Firestore composite index
      booksList.sort((a, b) => {
        if (a.rack_location < b.rack_location) return -1;
        if (a.rack_location > b.rack_location) return 1;
        if (a.title < b.title) return -1;
        if (a.title > b.title) return 1;
        return 0;
      });

      allBooks = booksList;
      renderBooks();
    } catch (err) {
      console.error('Firestore fetch error:', err);
      toast('Failed to load books from Firestore', 'error');
    } finally {
      showLoading(false);
    }
  }

  /* ── Render book cards ───────────────────────────────────────────── */
  function renderBooks() {
    const query = searchInput.value.trim().toLowerCase();
    let filtered = allBooks;

    // Client-side search (Firestore doesn't support LIKE queries)
    if (query) {
      filtered = filtered.filter((b) =>
        b.title.toLowerCase().includes(query) ||
        b.author.toLowerCase().includes(query) ||
        b.rack_location.toLowerCase().includes(query)
      );
    }

    // Availability filter
    if (activeFilter === 'available') {
      filtered = filtered.filter((b) => b.is_available);
    } else if (activeFilter === 'checked-out') {
      filtered = filtered.filter((b) => !b.is_available);
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
    const isAuth = !!currentUser;

    // Only show action buttons if user is authenticated (not guest)
    let actionButtons = '';
    if (isAuth && available) {
      actionButtons = `<button class="btn btn-issue" data-action="issue" data-id="${book.id}" data-title="${esc(book.title)}" id="issue-btn-${book.id}">📤 Issue Book</button>`;
    } else if (isAuth && !available) {
      actionButtons = `<button class="btn btn-return" data-action="return" data-id="${book.id}" data-title="${esc(book.title)}" id="return-btn-${book.id}">📥 Return Book</button>`;
    } else if (!isAuth) {
      actionButtons = `<span class="guest-hint">🔒 Log in to issue/return</span>`;
    }

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
          ${actionButtons}
        </div>
      </article>
    `;
  }

  /* ── Card action handler ─────────────────────────────────────────── */
  function handleCardAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const bookId = btn.dataset.id;
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

    if (!currentUser) {
      toast('You must be logged in to issue books', 'error');
      return;
    }

    issueConfirmBtn.disabled = true;
    issueConfirmBtn.textContent = 'Processing…';

    try {
      const bookRef = db.collection('books').doc(issueBookId);

      // Run as a Firestore transaction for atomicity
      await db.runTransaction(async (transaction) => {
        const bookDoc = await transaction.get(bookRef);

        if (!bookDoc.exists) {
          throw new Error('Book not found');
        }
        if (!bookDoc.data().is_available) {
          throw new Error('Book is already checked out');
        }

        // Mark book as unavailable
        transaction.update(bookRef, { is_available: false });

        // Create transaction record
        const txnRef = db.collection('transactions').doc();
        transaction.set(txnRef, {
          book_id:     issueBookId,
          student_id:  studentId,
          issue_date:  firebase.firestore.FieldValue.serverTimestamp(),
          return_date: null,
        });
      });

      const book = allBooks.find((b) => b.id === issueBookId);
      toast(`"${book?.title || 'Book'}" issued to ${studentId}`, 'success');
      closeIssueModal();
      await fetchBooks();
    } catch (err) {
      console.error('Issue error:', err);
      toast(err.message || 'Failed to issue book', 'error');
    } finally {
      issueConfirmBtn.disabled = false;
      issueConfirmBtn.textContent = 'Confirm Issue';
    }
  }

  /* ── Return flow ─────────────────────────────────────────────────── */
  async function returnBook(bookId) {
    if (!currentUser) {
      toast('You must be logged in to return books', 'error');
      return;
    }

    try {
      const bookRef = db.collection('books').doc(bookId);

      await db.runTransaction(async (transaction) => {
        const bookDoc = await transaction.get(bookRef);

        if (!bookDoc.exists) {
          throw new Error('Book not found');
        }
        if (bookDoc.data().is_available) {
          throw new Error('Book is already on the shelf');
        }

        // Mark book as available
        transaction.update(bookRef, { is_available: true });
      });

      // Update the open transaction record (outside the Firestore transaction
      // since we need a query which isn't supported inside transactions easily)
      const txnSnapshot = await db.collection('transactions')
        .where('book_id', '==', bookId)
        .where('return_date', '==', null)
        .orderBy('issue_date', 'desc')
        .limit(1)
        .get();

      if (!txnSnapshot.empty) {
        await txnSnapshot.docs[0].ref.update({
          return_date: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      const book = allBooks.find((b) => b.id === bookId);
      toast(`"${book?.title || 'Book'}" returned to ${book?.rack_location || 'shelf'}`, 'success');
      await fetchBooks();
    } catch (err) {
      console.error('Return error:', err);
      toast(err.message || 'Failed to return book', 'error');
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
    if (str === null || str === undefined) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ═══════════════════════════════════════════════════════════════════
     ADMIN PORTAL LOGIC & ROUTING
     ═══════════════════════════════════════════════════════════════════ */
  
  const adminLoginScreen = document.getElementById('admin-login-screen');
  const adminPortalContainer = document.getElementById('admin-portal-container');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminAuthError = document.getElementById('admin-auth-error');
  const backToUserBtn = document.getElementById('back-to-user-btn');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');
  
  const adminViewDashboard = document.getElementById('admin-view-dashboard');
  const adminViewBooks = document.getElementById('admin-view-books');
  const adminNavLinks = document.querySelectorAll('.admin-nav-link[data-admin-tab]');
  
  const adminBookModal = document.getElementById('admin-book-modal');
  const adminBookForm = document.getElementById('admin-book-form');
  const adminBookModalClose = document.getElementById('admin-book-modal-close');
  const adminBookCancelBtn = document.getElementById('admin-book-cancel-btn');
  const adminBookModalTitle = document.getElementById('admin-book-modal-title');
  const adminSearchInput = document.getElementById('admin-search-input');
  
  const adminDeleteModal = document.getElementById('admin-delete-modal');
  const adminDeleteCancelBtn = document.getElementById('admin-delete-cancel-btn');
  const adminDeleteConfirmBtn = document.getElementById('admin-delete-confirm-btn');
  const adminDeleteBookTitle = document.getElementById('admin-delete-book-title');
  
  let adminBooks = [];
  let bookToDelete = null;

  function initRouter() {
    const path = window.location.pathname;
    
    // Hide everything initially
    authScreen.classList.add('hidden');
    appContainer.classList.add('hidden');
    adminLoginScreen.classList.add('hidden');
    adminPortalContainer.classList.add('hidden');

    if (path.startsWith('/admin')) {
      // It's an admin route
      auth.onAuthStateChanged(user => {
        if (user && user.email === 'admin@library.com') { // Hardcoded admin check
          showAdminPortal(path);
        } else {
          // If not logged in as admin, force login
          if (user) auth.signOut();
          adminLoginScreen.classList.remove('hidden');
        }
      });
    } else {
      // Normal user route, managed by the original auth listener
      if (currentUser) {
        enterApp();
      } else if (!isGuest) {
        authScreen.classList.remove('hidden');
      } else {
        enterApp();
      }
    }
  }

  function showAdminPortal(path) {
    adminPortalContainer.classList.remove('hidden');
    if (path === '/admin/books') {
      switchAdminTab('books');
    } else {
      switchAdminTab('dashboard'); // default to dashboard
      window.history.replaceState({}, '', '/admin/dashboard');
    }
    fetchAdminBooks();
  }

  function switchAdminTab(tab) {
    adminNavLinks.forEach(link => {
      if (link.dataset.adminTab === tab) link.classList.add('active');
      else link.classList.remove('active');
    });

    if (tab === 'dashboard') {
      adminViewDashboard.classList.remove('hidden');
      adminViewBooks.classList.add('hidden');
      window.history.pushState({}, '', '/admin/dashboard');
    } else if (tab === 'books') {
      adminViewBooks.classList.remove('hidden');
      adminViewDashboard.classList.add('hidden');
      window.history.pushState({}, '', '/admin/books');
    }
  }

  adminNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      switchAdminTab(link.dataset.adminTab);
    });
  });

  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminAuthError.classList.add('hidden');
    const email = document.getElementById('admin-login-email').value.trim();
    const pass = document.getElementById('admin-login-password').value;
    
    if (email !== 'admin@library.com') {
      adminAuthError.textContent = "Unauthorized email.";
      adminAuthError.classList.remove('hidden');
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      adminAuthError.textContent = friendlyAuthError(err);
      adminAuthError.classList.remove('hidden');
    }
  });

  adminLogoutBtn.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = '/admin/login';
  });

  backToUserBtn.addEventListener('click', () => {
    window.location.href = '/';
  });

  // Intercept normal browser navigation
  window.addEventListener('popstate', () => {
    initRouter();
  });

  // Admin Books Fetch
  async function fetchAdminBooks() {
    try {
      const snapshot = await db.collection('books').get();
      adminBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      adminBooks.sort((a, b) => (a.title < b.title ? -1 : 1));
      
      updateDashboardStats();
      renderAdminBooksTable();
    } catch (err) {
      console.error(err);
      toast('Failed to load admin data', 'error');
    }
  }

  function updateDashboardStats() {
    document.getElementById('stat-total-books').textContent = adminBooks.length;
    const available = adminBooks.filter(b => b.is_available).length;
    document.getElementById('stat-available-books').textContent = available;
    document.getElementById('stat-borrowed-books').textContent = adminBooks.length - available;
    
    // Total copies logic (default 1 if missing)
    const totalCopies = adminBooks.reduce((sum, b) => sum + (parseInt(b.quantity) || 1), 0);
    document.getElementById('stat-total-copies').textContent = totalCopies;

    // Recent activity (latest 5)
    const recentList = document.getElementById('admin-recent-list');
    const sorted = [...adminBooks].sort((a, b) => {
      const ta = a.created_at ? a.created_at.toMillis() : 0;
      const tb = b.created_at ? b.created_at.toMillis() : 0;
      return tb - ta;
    });
    
    recentList.innerHTML = sorted.slice(0, 5).map(b => `
      <li>
        <strong>${esc(b.title)}</strong> added on ${b.created_at ? new Date(b.created_at.toDate()).toLocaleDateString() : 'Unknown'}
      </li>
    `).join('');
  }

  function renderAdminBooksTable() {
    const tbody = document.getElementById('admin-books-tbody');
    const emptyState = document.getElementById('admin-books-empty');
    const q = adminSearchInput.value.toLowerCase().trim();
    
    let filtered = adminBooks;
    if (q) {
      filtered = filtered.filter(b => 
        (b.title || '').toLowerCase().includes(q) || 
        (b.author || '').toLowerCase().includes(q) || 
        (b.isbn || '').toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    tbody.innerHTML = filtered.map(b => `
      <tr>
        <td>
          <div style="font-weight:600">${esc(b.title)}</div>
          <div style="font-size:0.8rem;color:var(--clr-text-secondary)">${esc(b.publisher || '')} ${esc(b.year || '')}</div>
        </td>
        <td>${esc(b.author)}</td>
        <td>${esc(b.category || '-')}</td>
        <td>${esc(b.isbn)}</td>
        <td>
          <span style="color:${b.is_available ? 'var(--clr-accent)' : 'var(--clr-danger)'}">
            ${b.is_available ? 'Available' : 'Out'}
          </span>
          <div style="font-size:0.8rem;color:var(--clr-text-secondary)">
             ${esc(b.available_qty || (b.is_available ? 1 : 0))} / ${esc(b.quantity || 1)}
          </div>
        </td>
        <td>${esc(b.rack_location)}</td>
        <td class="actions">
          <button class="btn-edit" data-id="${b.id}">✏️ Edit</button>
          <button class="btn-delete" data-id="${b.id}">🗑️ Delete</button>
        </td>
      </tr>
    `).join('');

    // Attach listeners
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openAdminBookModal(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => openAdminDeleteModal(btn.dataset.id));
    });
  }

  adminSearchInput.addEventListener('input', renderAdminBooksTable);

  document.getElementById('admin-add-book-btn').addEventListener('click', () => {
    openAdminBookModal();
  });

  function openAdminBookModal(id = null) {
    adminBookForm.reset();
    document.getElementById('admin-book-id').value = '';
    adminBookModalTitle.textContent = 'Add New Book';
    
    if (id) {
      const book = adminBooks.find(b => b.id === id);
      if (book) {
        adminBookModalTitle.textContent = 'Edit Book';
        document.getElementById('admin-book-id').value = book.id;
        document.getElementById('admin-book-title').value = book.title || '';
        document.getElementById('admin-book-author').value = book.author || '';
        document.getElementById('admin-book-isbn').value = book.isbn || '';
        document.getElementById('admin-book-category').value = book.category || '';
        document.getElementById('admin-book-publisher').value = book.publisher || '';
        document.getElementById('admin-book-year').value = book.year || '';
        document.getElementById('admin-book-cover').value = book.cover_url || '';
        document.getElementById('admin-book-desc').value = book.description || '';
        
        document.getElementById('admin-book-qty').value = book.quantity || 1;
        document.getElementById('admin-book-avail').value = book.available_qty || (book.is_available ? 1 : 0);
        
        // Parse "Floor 1, Row A, Rack 1" if available
        const loc = book.rack_location || '';
        const parts = loc.split(',').map(s => s.trim());
        document.getElementById('admin-book-floor').value = parts[0] || '';
        document.getElementById('admin-book-row').value = parts[1] || '';
        document.getElementById('admin-book-rack').value = parts[2] || '';
      }
    }
    
    adminBookModal.classList.remove('hidden');
  }

  adminBookModalClose.addEventListener('click', () => adminBookModal.classList.add('hidden'));
  adminBookCancelBtn.addEventListener('click', () => adminBookModal.classList.add('hidden'));

  adminBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('admin-book-id').value;
    
    const qty = parseInt(document.getElementById('admin-book-qty').value) || 1;
    const avail = parseInt(document.getElementById('admin-book-avail').value) || 0;
    
    if (avail > qty) {
      toast('Available quantity cannot exceed total quantity.', 'error');
      return;
    }

    const data = {
      title: document.getElementById('admin-book-title').value.trim(),
      author: document.getElementById('admin-book-author').value.trim(),
      isbn: document.getElementById('admin-book-isbn').value.trim(),
      category: document.getElementById('admin-book-category').value.trim(),
      publisher: document.getElementById('admin-book-publisher').value.trim(),
      year: parseInt(document.getElementById('admin-book-year').value) || null,
      cover_url: document.getElementById('admin-book-cover').value.trim(),
      description: document.getElementById('admin-book-desc').value.trim(),
      quantity: qty,
      available_qty: avail,
      is_available: avail > 0,
      rack_location: `${document.getElementById('admin-book-floor').value.trim()}, ${document.getElementById('admin-book-row').value.trim()}, ${document.getElementById('admin-book-rack').value.trim()}`
    };

    const saveBtn = document.getElementById('admin-book-save-btn');
    saveBtn.disabled = true;

    try {
      if (id) {
        await db.collection('books').doc(id).update(data);
        toast('Book updated successfully!', 'success');
      } else {
        data.created_at = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('books').add(data);
        toast('Book added successfully!', 'success');
      }
      adminBookModal.classList.add('hidden');
      await fetchAdminBooks(); // refresh list
      if (!window.location.pathname.startsWith('/admin')) fetchBooks(); // if used in mixed context
    } catch (err) {
      console.error(err);
      toast('Error saving book', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  function openAdminDeleteModal(id) {
    bookToDelete = id;
    const book = adminBooks.find(b => b.id === id);
    if (!book) return;
    
    adminDeleteBookTitle.textContent = book.title;
    adminDeleteModal.classList.remove('hidden');
  }

  adminDeleteCancelBtn.addEventListener('click', () => {
    adminDeleteModal.classList.add('hidden');
    bookToDelete = null;
  });

  adminDeleteConfirmBtn.addEventListener('click', async () => {
    if (!bookToDelete) return;
    adminDeleteConfirmBtn.disabled = true;
    try {
      await db.collection('books').doc(bookToDelete).delete();
      toast('Book deleted.', 'success');
      adminDeleteModal.classList.add('hidden');
      await fetchAdminBooks();
    } catch (err) {
      console.error(err);
      toast('Error deleting book', 'error');
    } finally {
      adminDeleteConfirmBtn.disabled = false;
      bookToDelete = null;
    }
  });

  // Call initRouter immediately to handle first load
  initRouter();

})();
