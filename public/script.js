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
  const userNameEl      = document.getElementById('user-name');
  const userRegEl       = document.getElementById('user-reg');

  /* ── DOM refs — Profile Completion ────────────────────────────────── */
  const profileScreen   = document.getElementById('profile-screen');
  const profileForm     = document.getElementById('profile-form');
  const profileNameIn   = document.getElementById('profile-name');
  const profileRegIn    = document.getElementById('profile-reg');
  const profileError    = document.getElementById('profile-error');

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
  const studentNameInput = document.getElementById('student-name-input');
  const toastContainer  = document.getElementById('toast-container');

  /* ── State ───────────────────────────────────────────────────────── */
  let allBooks = [];
  let activeFilter = 'all';
  let debounceTimer = null;
  let issueBookId = null;
  let currentUser = null;
  let isGuest = false;
  let bookmarks = new Set();

  /* ── Bookmark helpers ─────────────────────────────────────────────── */
  function getBookmarkKey() {
    return currentUser ? `libsync_bookmarks_${currentUser.uid}` : null;
  }

  function loadBookmarks() {
    const key = getBookmarkKey();
    if (!key) { bookmarks = new Set(); return; }
    try {
      const saved = localStorage.getItem(key);
      bookmarks = saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { bookmarks = new Set(); }
  }

  function saveBookmarks() {
    const key = getBookmarkKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify([...bookmarks]));
  }

  function toggleBookmark(bookId) {
    if (bookmarks.has(bookId)) {
      bookmarks.delete(bookId);
      toast('Bookmark removed', 'info');
    } else {
      bookmarks.add(bookId);
      toast('Book bookmarked! 🔖', 'success');
    }
    saveBookmarks();
    renderBooks();
  }

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
      const userCredential = await auth.signInWithEmailAndPassword(email, pass);
      if (!userCredential.user.emailVerified && email !== 'admin@library.com') {
        await auth.signOut();
        showAuthError('Please verify your email before logging in. Check your inbox.');
        return;
      }
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
      const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
      await userCredential.user.sendEmailVerification();
      // Save user to Firestore so admin can view them
      await db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        role: 'user'
      });
      await auth.signOut();
      toast('Verification email sent! Please check your inbox.', 'info');
      tabLogin.click();
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
    profileScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
  });

  /* ── Firebase Auth State Listener ───────────────────────────────── */
  auth.onAuthStateChanged((user) => {
    // If on an admin route, let the admin logic handle this
    if (window.location.pathname.startsWith('/admin')) {
      return;
    }

    if (user && (user.emailVerified || user.email === 'admin@library.com')) {
      currentUser = user;
      isGuest = false;
      checkProfileAndEnter();
    } else if (user && !user.emailVerified) {
      // Allow sign out to clear state
      auth.signOut();
    } else if (!isGuest) {
      currentUser = null;
      // Show auth screen
      appContainer.classList.add('hidden');
      profileScreen.classList.add('hidden');
      authScreen.classList.remove('hidden');
    }
  });

  /* ── Profile check — ensure name & reg number exist ─────────────── */
  async function checkProfileAndEnter() {
    // Admin bypasses profile check
    if (currentUser.email === 'admin@library.com') {
      enterApp();
      return;
    }

    try {
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      const data = userDoc.exists ? userDoc.data() : {};

      if (data.full_name && data.registration_number) {
        // Profile is complete — go to app
        enterApp(data);
      } else {
        // Show profile completion screen
        authScreen.classList.add('hidden');
        appContainer.classList.add('hidden');
        profileScreen.classList.remove('hidden');

        // Pre-fill if partial data exists
        if (data.full_name) profileNameIn.value = data.full_name;
        if (data.registration_number) profileRegIn.value = data.registration_number;

        setTimeout(() => profileNameIn.focus(), 100);
      }
    } catch (err) {
      console.error('Profile check error:', err);
      // If Firestore fails, still let them in
      enterApp();
    }
  }

  /* ── Profile form submit ────────────────────────────────────────── */
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileError.classList.add('hidden');

    const fullName = profileNameIn.value.trim();
    const regNumber = profileRegIn.value.trim();

    if (!fullName) {
      profileError.textContent = 'Please enter your full name.';
      profileError.classList.remove('hidden');
      profileNameIn.focus();
      return;
    }
    if (!regNumber) {
      profileError.textContent = 'Please enter your registration number.';
      profileError.classList.remove('hidden');
      profileRegIn.focus();
      return;
    }

    const submitBtn = profileForm.querySelector('.btn-auth');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    submitBtn.disabled = true;
    btnText.textContent = 'Saving…';
    btnLoader.classList.remove('hidden');

    try {
      await db.collection('users').doc(currentUser.uid).set({
        email: currentUser.email,
        full_name: fullName,
        registration_number: regNumber,
        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      profileScreen.classList.add('hidden');
      enterApp({ full_name: fullName, registration_number: regNumber });
    } catch (err) {
      console.error('Profile save error:', err);
      profileError.textContent = 'Failed to save profile. Please try again.';
      profileError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      btnText.textContent = 'Save & Continue';
      btnLoader.classList.add('hidden');
    }
  });

  /* ── Enter the app ──────────────────────────────────────────────── */
  async function enterApp(profileData = null) {
    authScreen.classList.add('hidden');
    profileScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');

    if (currentUser) {
      userBar.classList.remove('hidden');
      guestBar.classList.add('hidden');

      if (currentUser.email === 'admin@library.com') {
        if (userNameEl) userNameEl.textContent = '👑 Admin';
        if (userRegEl) userRegEl.textContent = currentUser.email;
      } else if (profileData && profileData.full_name) {
        if (userNameEl) userNameEl.textContent = profileData.full_name;
        if (userRegEl) userRegEl.textContent = profileData.registration_number ? `ID: ${profileData.registration_number}` : currentUser.email;
      } else {
        try {
          const userDoc = await db.collection('users').doc(currentUser.uid).get();
          if (userDoc.exists) {
            const data = userDoc.data();
            if (userNameEl) userNameEl.textContent = data.full_name || currentUser.email;
            if (userRegEl) userRegEl.textContent = data.registration_number ? `ID: ${data.registration_number}` : '';
          } else {
            if (userNameEl) userNameEl.textContent = currentUser.email;
            if (userRegEl) userRegEl.textContent = '';
          }
        } catch (e) {
          console.error('Error loading profile for header:', e);
          if (userNameEl) userNameEl.textContent = currentUser.email;
        }
      }
      loadBookmarks();
    } else {
      userBar.classList.add('hidden');
      guestBar.classList.remove('hidden');
      bookmarks = new Set();
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
    } else if (activeFilter === 'bookmarked') {
      filtered = filtered.filter((b) => bookmarks.has(b.id));
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
    const isAdmin = currentUser && currentUser.email === 'admin@library.com';

    // Bookmark state for this book
    const isBookmarked = bookmarks.has(book.id);
    const bookmarkClass = isBookmarked ? 'bookmarked' : '';
    const bookmarkLabel = isBookmarked ? '🔖 Bookmarked' : '🔖 Bookmark';

    // Action buttons based on role
    let actionButtons = '';
    if (isAdmin && !available) {
      actionButtons = `<button class="btn btn-return" data-action="return" data-id="${book.id}" data-title="${esc(book.title)}" id="return-btn-${book.id}">📥 Return Book</button>`;
    } else if (isAuth && !available) {
      actionButtons = `<span class="guest-hint">📕 Currently Unavailable</span>`;
    } else if (!isAuth) {
      actionButtons = `<span class="guest-hint">🔒 Log in to bookmark books</span>`;
    }

    // Add bookmark button for all logged-in users
    if (isAuth) {
      actionButtons = `<button class="btn btn-bookmark ${bookmarkClass}" data-action="bookmark" data-id="${book.id}" id="bookmark-btn-${book.id}">${bookmarkLabel}</button>` + (actionButtons ? `\n${actionButtons}` : '');
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
    } else if (action === 'bookmark') {
      toggleBookmark(bookId);
    }
  }

  /* ── Issue flow ──────────────────────────────────────────────────── */
  function openIssueModal(bookId, title) {
    issueBookId = bookId;
    issueBookTitle.textContent = title;
    studentIdInput.value = '';
    studentNameInput.value = '';
    issueModal.classList.remove('hidden');
    setTimeout(() => studentIdInput.focus(), 100);
  }

  function closeIssueModal() {
    issueModal.classList.add('hidden');
    issueBookId = null;
  }

  async function confirmIssue() {
    const studentId = studentIdInput.value.trim();
    const studentName = studentNameInput.value.trim();
    if (!studentId) {
      toast('Please enter a Student ID', 'error');
      studentIdInput.focus();
      return;
    }
    if (!studentName) {
      toast('Please enter a Student Name', 'error');
      studentNameInput.focus();
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

        // Calculate due date (14 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // Create transaction record
        const txnRef = db.collection('transactions').doc();
        transaction.set(txnRef, {
          book_id:      issueBookId,
          student_id:   studentId,
          student_name: studentName,
          issue_date:   firebase.firestore.FieldValue.serverTimestamp(),
          due_date:     firebase.firestore.Timestamp.fromDate(dueDate),
          return_date:  null,
          warning_sent: false,
          warning_date: null,
          fine_applied: false,
          fine_amount:  0,
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
  const adminViewUsers = document.getElementById('admin-view-users');
  const adminViewRecords = document.getElementById('admin-view-records');
  const adminViewReservations = document.getElementById('admin-view-reservations');
  const adminViewSettings = document.getElementById('admin-view-settings');
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
    adminLoginScreen.classList.add('hidden');
    adminPortalContainer.classList.remove('hidden');
    const tab = path.replace('/admin/', '') || 'dashboard';
    if (['dashboard', 'books', 'users', 'records', 'reservations', 'settings'].includes(tab)) {
      switchAdminTab(tab);
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

    const views = {
      dashboard: adminViewDashboard,
      books: adminViewBooks,
      users: adminViewUsers,
      records: adminViewRecords,
      reservations: adminViewReservations,
      settings: adminViewSettings
    };

    Object.values(views).forEach(view => {
      if (view) view.classList.add('hidden');
    });

    if (views[tab]) {
      views[tab].classList.remove('hidden');
      window.history.pushState({}, '', `/admin/${tab}`);
      
      if (tab === 'users') fetchAdminUsers();
      if (tab === 'records') fetchAdminRecords();
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
  // Admin Users Fetch
  async function fetchAdminUsers() {
    try {
      const snapshot = await db.collection('users').get();
      const tbody = document.getElementById('admin-users-tbody');
      const emptyState = document.getElementById('admin-users-empty');

      if (snapshot.empty) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      tbody.innerHTML = snapshot.docs.map(doc => {
        const u = doc.data();
        const date = u.created_at ? new Date(u.created_at.toDate()).toLocaleDateString() : 'Unknown';
        return `
          <tr>
            <td>${doc.id}</td>
            <td>${esc(u.email)}</td>
            <td><span style="color:var(--clr-accent)">${esc(u.role || 'user')}</span></td>
            <td>${date}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      toast('Failed to load users', 'error');
    }
  }

  // Admin Borrowing Records Fetch
  async function fetchAdminRecords() {
    try {
      if (adminBooks.length === 0) {
        const snapshot = await db.collection('books').get();
        adminBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const snapshot = await db.collection('transactions').orderBy('issue_date', 'desc').get();
      const tbody = document.getElementById('admin-records-tbody');
      const emptyState = document.getElementById('admin-records-empty');

      if (snapshot.empty) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      tbody.innerHTML = snapshot.docs.map(doc => {
        const t = doc.data();
        const book = adminBooks.find(b => b.id === t.book_id);
        const title = book ? book.title : 'Unknown Book';
        const issueDate = t.issue_date ? new Date(t.issue_date.toDate()).toLocaleDateString() : 'Unknown';
        const dueDate = t.due_date ? new Date(t.due_date.toDate()).toLocaleDateString() : 'Unknown';
        const returnDate = t.return_date ? new Date(t.return_date.toDate()).toLocaleDateString() : '-';
        const fine = t.fine_amount ? `₹${t.fine_amount}` : '-';
        const status = t.return_date ? '<span style="color:var(--clr-accent)">Returned</span>' : '<span style="color:var(--clr-danger)">Checked Out</span>';

        return `
          <tr>
            <td style="font-weight:600">${esc(title)}</td>
            <td>${esc(t.student_id)}</td>
            <td>${issueDate}</td>
            <td>${dueDate}</td>
            <td>${returnDate}</td>
            <td style="color:var(--clr-danger);font-weight:bold;">${fine}</td>
            <td>${status}</td>
            <td>
              ${!t.return_date ? `<button class="btn-edit btn-edit-due-date" data-id="${doc.id}" data-due="${t.due_date ? new Date(t.due_date.toDate()).toISOString().split('T')[0] : ''}">📅 Edit Due Date</button>` : '-'}
            </td>
          </tr>
        `;
      }).join('');

      // Attach event listeners for edit due date buttons
      tbody.querySelectorAll('.btn-edit-due-date').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('admin-edit-due-date-txn-id').value = btn.dataset.id;
          document.getElementById('admin-edit-due-date-input').value = btn.dataset.due;
          document.getElementById('admin-edit-due-date-modal').classList.remove('hidden');
        });
      });
    } catch (err) {
      console.error(err);
      toast('Failed to load borrowing records', 'error');
    }
  }

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

  // ─── Admin Manual Issue Logic ────────────────────────────────────
  const adminManualIssueBtn = document.getElementById('admin-manual-issue-btn');
  const adminManualIssueModal = document.getElementById('admin-manual-issue-modal');
  const adminManualIssueForm = document.getElementById('admin-manual-issue-form');
  const adminManualIssueClose = document.getElementById('admin-manual-issue-close');
  const adminManualIssueCancelBtn = document.getElementById('admin-manual-issue-cancel-btn');
  const adminIssueBookSelect = document.getElementById('admin-issue-book-select');

  adminManualIssueBtn?.addEventListener('click', () => {
    // Populate select with available books
    adminIssueBookSelect.innerHTML = '<option value="">-- Choose an Available Book --</option>';
    const availableBooks = adminBooks.filter(b => b.is_available);
    availableBooks.forEach(b => {
      const option = document.createElement('option');
      option.value = b.id;
      option.textContent = `${b.title} (by ${b.author})`;
      adminIssueBookSelect.appendChild(option);
    });
    
    adminManualIssueForm.reset();
    adminManualIssueModal.classList.remove('hidden');
  });

  const closeAdminIssueModal = () => adminManualIssueModal.classList.add('hidden');
  adminManualIssueClose?.addEventListener('click', closeAdminIssueModal);
  adminManualIssueCancelBtn?.addEventListener('click', closeAdminIssueModal);

  adminManualIssueForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bookId = adminIssueBookSelect.value;
    const studentId = document.getElementById('admin-issue-student-id').value.trim();
    const studentName = document.getElementById('admin-issue-student-name').value.trim();
    
    if (!bookId || !studentId || !studentName) {
      toast('Please fill all fields', 'error');
      return;
    }

    const btn = document.getElementById('admin-manual-issue-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const bookRef = db.collection('books').doc(bookId);

      await db.runTransaction(async (transaction) => {
        const bookDoc = await transaction.get(bookRef);
        if (!bookDoc.exists || !bookDoc.data().is_available) {
          throw new Error('Book is no longer available');
        }

        // Mark book as unavailable
        transaction.update(bookRef, { is_available: false });

        // Calculate due date (14 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // Create transaction record
        const txnRef = db.collection('transactions').doc();
        transaction.set(txnRef, {
          book_id: bookId,
          student_id: studentId,
          student_name: studentName,
          issue_date: firebase.firestore.FieldValue.serverTimestamp(),
          due_date: firebase.firestore.Timestamp.fromDate(dueDate),
          return_date: null,
          warning_sent: false,
          warning_date: null,
          fine_applied: false,
          fine_amount: 0,
          issued_by: 'admin_manual'
        });
      });

      toast('Book manually issued!', 'success');
      closeAdminIssueModal();
      await fetchAdminBooks(); // refresh admin state & dashboard stats
      await fetchAdminRecords(); // refresh records table
    } catch (err) {
      console.error('Manual Issue error:', err);
      toast(err.message || 'Error issuing book', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Issue Book';
    }
  });

  // ─── Admin Edit Due Date Logic ───────────────────────────────────
  const adminEditDueDateModal = document.getElementById('admin-edit-due-date-modal');
  const adminEditDueDateForm = document.getElementById('admin-edit-due-date-form');
  const adminEditDueDateClose = document.getElementById('admin-edit-due-date-close');
  const adminEditDueDateCancelBtn = document.getElementById('admin-edit-due-date-cancel-btn');

  const closeAdminEditDueDateModal = () => adminEditDueDateModal.classList.add('hidden');
  adminEditDueDateClose?.addEventListener('click', closeAdminEditDueDateModal);
  adminEditDueDateCancelBtn?.addEventListener('click', closeAdminEditDueDateModal);

  adminEditDueDateForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txnId = document.getElementById('admin-edit-due-date-txn-id').value;
    const newDueDateStr = document.getElementById('admin-edit-due-date-input').value;
    
    if (!txnId || !newDueDateStr) return;

    const btn = document.getElementById('admin-edit-due-date-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const newDueDate = new Date(newDueDateStr);
      await db.collection('transactions').doc(txnId).update({
        due_date: firebase.firestore.Timestamp.fromDate(newDueDate)
      });
      toast('Due date updated!', 'success');
      closeAdminEditDueDateModal();
      await fetchAdminRecords();
    } catch (err) {
      console.error(err);
      toast('Failed to update due date', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });

  // Call initRouter immediately to handle first load
  initRouter();

})();
