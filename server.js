const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ─────────────────────────────────────────────────────── */
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── GET /api/books ────────────────────────────────────────────────── */
app.get('/api/books', async (req, res) => {
  try {
    const search = req.query.search || '';
    let sql = 'SELECT * FROM books';
    let params = [];

    if (search.trim()) {
      sql += ` WHERE title LIKE ? OR author LIKE ? OR rack_location LIKE ?`;
      const like = `%${search.trim()}%`;
      params = [like, like, like];
    }

    sql += ' ORDER BY rack_location ASC, title ASC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, books: rows });
  } catch (err) {
    console.error('GET /api/books error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ── GET /api/books/:id ────────────────────────────────────────────── */
app.get('/api/books/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Book not found' });
    res.json({ success: true, book: rows[0] });
  } catch (err) {
    console.error('GET /api/books/:id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ── POST /api/books/issue ─────────────────────────────────────────── */
app.post('/api/books/issue', async (req, res) => {
  const { bookId, studentId } = req.body;

  if (!bookId || !studentId) {
    return res.status(400).json({ success: false, message: 'bookId and studentId are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check availability
    const [books] = await conn.query('SELECT * FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!books.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (!books[0].is_available) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Book is already checked out' });
    }

    // Mark unavailable
    await conn.query('UPDATE books SET is_available = 0 WHERE id = ?', [bookId]);

    // Log transaction
    await conn.query(
      'INSERT INTO transactions (book_id, student_id, issue_date) VALUES (?, ?, NOW())',
      [bookId, studentId]
    );

    await conn.commit();
    res.json({ success: true, message: `"${books[0].title}" issued to ${studentId}` });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/books/issue error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    conn.release();
  }
});

/* ── POST /api/books/return ────────────────────────────────────────── */
app.post('/api/books/return', async (req, res) => {
  const { bookId } = req.body;

  if (!bookId) {
    return res.status(400).json({ success: false, message: 'bookId is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check the book exists and is currently checked out
    const [books] = await conn.query('SELECT * FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!books.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (books[0].is_available) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Book is already on the shelf' });
    }

    // Mark available
    await conn.query('UPDATE books SET is_available = 1 WHERE id = ?', [bookId]);

    // Close the open transaction
    await conn.query(
      `UPDATE transactions SET return_date = NOW()
       WHERE book_id = ? AND return_date IS NULL
       ORDER BY issue_date DESC LIMIT 1`,
      [bookId]
    );

    await conn.commit();
    res.json({ success: true, message: `"${books[0].title}" returned to ${books[0].rack_location}` });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/books/return error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    conn.release();
  }
});

/* ── Start ─────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`📚  Library server running → http://localhost:${PORT}`);
});
