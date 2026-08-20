/**
 * seed-firebase.js — Populates Firestore with library books & sample transactions.
 *
 * Prerequisites:
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Go to Project Settings → Service Accounts → Generate New Private Key
 *   3. Save the JSON file as "serviceAccountKey.json" in this directory
 *   4. Run:  npm run seed
 *
 * ⚠️  This will CLEAR existing books & transactions collections before seeding.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seed() {
  console.log('🔥  Connecting to Firestore…');

  /* ── 1. Clear existing data ─────────────────────────────────────── */
  async function clearCollection(name) {
    const snapshot = await db.collection(name).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    if (snapshot.size > 0) await batch.commit();
    console.log(`   Cleared ${snapshot.size} docs from "${name}"`);
  }

  await clearCollection('transactions');
  await clearCollection('books');

  /* ── 2. Seed books ──────────────────────────────────────────────── */
  const books = [
    // Mathematics
    { title: 'Higher Engineering Mathematics',         author: 'B.S. Grewal',          isbn: '978-8174091954', rack_location: 'Floor 1, Row A, Rack 1', is_available: true  },
    { title: 'Advanced Engineering Mathematics',       author: 'Erwin Kreyszig',       isbn: '978-8126554232', rack_location: 'Floor 1, Row A, Rack 2', is_available: true  },

    // Physics
    { title: 'Engineering Physics',                    author: 'Hitendra K. Malik',     isbn: '978-0070671539', rack_location: 'Floor 1, Row B, Rack 1', is_available: true  },
    { title: 'Concepts of Modern Physics',             author: 'Arthur Beiser',         isbn: '978-9351341857', rack_location: 'Floor 1, Row B, Rack 2', is_available: false },

    // Chemistry
    { title: 'Engineering Chemistry',                  author: 'Jain & Jain',           isbn: '978-9352160006', rack_location: 'Floor 1, Row C, Rack 1', is_available: true  },
    { title: 'A Text Book of Engineering Chemistry',   author: 'Shashi Chawla',         isbn: '978-8110004561', rack_location: 'Floor 1, Row C, Rack 2', is_available: true  },

    // Electrical & Electronics
    { title: 'Basic Electrical Engineering',           author: 'V.K. Mehta',            isbn: '978-8121908719', rack_location: 'Floor 2, Row A, Rack 1', is_available: true  },
    { title: 'Basic Electrical Engineering',           author: 'D.P. Kothari',          isbn: '978-9353167104', rack_location: 'Floor 2, Row A, Rack 2', is_available: false },
    { title: 'Electronic Devices and Circuit Theory',  author: 'Robert L. Boylestad',   isbn: '978-9332542600', rack_location: 'Floor 2, Row B, Rack 1', is_available: true  },

    // Mechanics
    { title: 'Engineering Mechanics',                  author: 'S.S. Bhavikatti',       isbn: '978-8122423747', rack_location: 'Floor 2, Row C, Rack 1', is_available: true  },
    { title: 'A Textbook of Engineering Mechanics',    author: 'R.K. Bansal',           isbn: '978-8131804094', rack_location: 'Floor 2, Row C, Rack 2', is_available: true  },

    // Programming (C / Intro to Computers)
    { title: 'Programming in ANSI C',                 author: 'E. Balagurusamy',       isbn: '978-9353165131', rack_location: 'Floor 3, Row A, Rack 1', is_available: true  },
    { title: 'Let Us C',                               author: 'Yashavant Kanetkar',    isbn: '978-8183331630', rack_location: 'Floor 3, Row A, Rack 2', is_available: false },
    { title: 'Computer Fundamentals',                  author: 'P.K. Sinha',            isbn: '978-8176567527', rack_location: 'Floor 3, Row B, Rack 1', is_available: true  },

    // Engineering Drawing / Graphics
    { title: 'Engineering Drawing',                    author: 'N.D. Bhatt',            isbn: '978-9380358178', rack_location: 'Floor 3, Row C, Rack 1', is_available: true  },
    { title: 'Engineering Graphics',                   author: 'K. Venugopal',          isbn: '978-8122424577', rack_location: 'Floor 3, Row C, Rack 2', is_available: true  },

    // Environmental Science & English/Communication
    { title: 'Environmental Studies',                  author: 'Erach Bharucha',        isbn: '978-8173715402', rack_location: 'Floor 4, Row A, Rack 1', is_available: true  },
    { title: 'Communication Skills for Engineers',     author: 'Sunita Mishra',         isbn: '978-8131733837', rack_location: 'Floor 4, Row A, Rack 2', is_available: true  },

    // Thermodynamics / Basic Mechanical
    { title: 'Engineering Thermodynamics',             author: 'P.K. Nag',              isbn: '978-9352606418', rack_location: 'Floor 4, Row B, Rack 1', is_available: false },
    { title: 'Basic Mechanical Engineering',           author: 'Pravin Kumar',          isbn: '978-8131798751', rack_location: 'Floor 4, Row B, Rack 2', is_available: true  },
  ];

  // Store references so we can link transactions to book IDs
  const bookRefs = [];

  for (const book of books) {
    const ref = await db.collection('books').add({
      ...book,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    bookRefs.push(ref);
  }

  console.log(`   ✅  Inserted ${books.length} books`);

  /* ── 3. Seed sample transactions (for checked-out books) ────────── */
  // Books at index 3, 7, 12, 18 are marked is_available: false
  const transactions = [
    { bookIndex: 3,  studentId: 'STU-2024-001', issueDate: new Date('2026-08-15T10:00:00') },
    { bookIndex: 7,  studentId: 'STU-2024-003', issueDate: new Date('2026-08-18T14:30:00') },
    { bookIndex: 12, studentId: 'STU-2024-007', issueDate: new Date('2026-08-19T09:15:00') },
    { bookIndex: 18, studentId: 'STU-2024-012', issueDate: new Date('2026-08-20T11:00:00') },
  ];

  for (const txn of transactions) {
    await db.collection('transactions').add({
      book_id:     bookRefs[txn.bookIndex].id,
      student_id:  txn.studentId,
      issue_date:  admin.firestore.Timestamp.fromDate(txn.issueDate),
      return_date: null,
    });
  }

  console.log(`   ✅  Inserted ${transactions.length} transactions`);
  console.log('\n🎉  Firestore seeded successfully — 20 books + 4 active transactions');
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
