/**
 * seed.js — Creates the database, tables, and populates dummy books.
 *
 * Run once:  npm run seed
 *
 * IMPORTANT: Update the `rootPassword` variable below to match
 * your local MySQL root password (leave '' if there is no password).
 */

const mysql = require('mysql2/promise');

const rootPassword = '7855959391';   // ← change this

async function seed() {
  /* ── 1. Connect WITHOUT selecting a database ─────────────────────── */
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: rootPassword,
    multipleStatements: true,
  });

  /* ── 2. Create the database ──────────────────────────────────────── */
  await conn.query('CREATE DATABASE IF NOT EXISTS library_db');
  await conn.query('USE library_db');

  /* ── 3. Create tables ────────────────────────────────────────────── */
  await conn.query(`
    CREATE TABLE IF NOT EXISTS books (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      title        VARCHAR(255)  NOT NULL,
      author       VARCHAR(255)  NOT NULL,
      isbn         VARCHAR(20)   NOT NULL,
      rack_location VARCHAR(100) NOT NULL,
      is_available  TINYINT(1)   NOT NULL DEFAULT 1,
      created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      book_id     INT          NOT NULL,
      student_id  VARCHAR(50)  NOT NULL,
      issue_date  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      return_date DATETIME     NULL,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
  `);

  /* ── 4. Clear existing data & seed dummy books ───────────────────── */
  await conn.query('DELETE FROM transactions');
  await conn.query('DELETE FROM books');
  await conn.query('ALTER TABLE books AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE transactions AUTO_INCREMENT = 1');

  const books = [
    // Mathematics
    ['Higher Engineering Mathematics', 'B.S. Grewal', '978-8174091954', 'Floor 1, Row A, Rack 1', 1],
    ['Advanced Engineering Mathematics', 'Erwin Kreyszig', '978-8126554232', 'Floor 1, Row A, Rack 2', 1],

    // Physics
    ['Engineering Physics', 'Hitendra K. Malik', '978-0070671539', 'Floor 1, Row B, Rack 1', 1],
    ['Concepts of Modern Physics', 'Arthur Beiser', '978-9351341857', 'Floor 1, Row B, Rack 2', 0],

    // Chemistry
    ['Engineering Chemistry', 'Jain & Jain', '978-9352160006', 'Floor 1, Row C, Rack 1', 1],
    ['A Text Book of Engineering Chemistry', 'Shashi Chawla', '978-8110004561', 'Floor 1, Row C, Rack 2', 1],

    // Electrical & Electronics
    ['Basic Electrical Engineering', 'V.K. Mehta', '978-8121908719', 'Floor 2, Row A, Rack 1', 1],
    ['Basic Electrical Engineering', 'D.P. Kothari', '978-9353167104', 'Floor 2, Row A, Rack 2', 0],
    ['Electronic Devices and Circuit Theory', 'Robert L. Boylestad', '978-9332542600', 'Floor 2, Row B, Rack 1', 1],

    // Mechanics
    ['Engineering Mechanics', 'S.S. Bhavikatti', '978-8122423747', 'Floor 2, Row C, Rack 1', 1],
    ['A Textbook of Engineering Mechanics', 'R.K. Bansal', '978-8131804094', 'Floor 2, Row C, Rack 2', 1],

    // Programming (C / Intro to Computers)
    ['Programming in ANSI C', 'E. Balagurusamy', '978-9353165131', 'Floor 3, Row A, Rack 1', 1],
    ['Let Us C', 'Yashavant Kanetkar', '978-8183331630', 'Floor 3, Row A, Rack 2', 0],
    ['Computer Fundamentals', 'P.K. Sinha', '978-8176567527', 'Floor 3, Row B, Rack 1', 1],

    // Engineering Drawing / Graphics
    ['Engineering Drawing', 'N.D. Bhatt', '978-9380358178', 'Floor 3, Row C, Rack 1', 1],
    ['Engineering Graphics', 'K. Venugopal', '978-8122424577', 'Floor 3, Row C, Rack 2', 1],

    // Environmental Science & English/Communication
    ['Environmental Studies', 'Erach Bharucha', '978-8173715402', 'Floor 4, Row A, Rack 1', 1],
    ['Communication Skills for Engineers', 'Sunita Mishra', '978-8131733837', 'Floor 4, Row A, Rack 2', 1],

    // Thermodynamics / Basic Mechanical
    ['Engineering Thermodynamics', 'P.K. Nag', '978-9352606418', 'Floor 4, Row B, Rack 1', 0],
    ['Basic Mechanical Engineering', 'Pravin Kumar', '978-8131798751', 'Floor 4, Row B, Rack 2', 1]
  ];

  const sql = `INSERT INTO books (title, author, isbn, rack_location, is_available) VALUES ?`;
  await conn.query(sql, [books]);

  // Add a sample transaction for one of the checked-out books
  await conn.query(`
    INSERT INTO transactions (book_id, student_id, issue_date)
    VALUES
      (4,  'STU-2024-001', '2026-08-15 10:00:00'),
      (7,  'STU-2024-003', '2026-08-18 14:30:00'),
      (12, 'STU-2024-007', '2026-08-19 09:15:00'),
      (18, 'STU-2024-012', '2026-08-20 11:00:00');
  `);

  console.log('✅  Database seeded successfully — 20 books + 4 active transactions');
  await conn.end();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
