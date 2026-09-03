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

    // Mathematics - Additional
    { title: 'Engineering Mathematics',                 author: 'B.V. Ramana',           isbn: '978-0070682160', rack_location: 'Floor 5, Row A, Rack 1', is_available: true  },
    { title: 'Higher Engineering Mathematics',         author: 'H.K. Dass',             isbn: '978-8177001267', rack_location: 'Floor 5, Row A, Rack 2', is_available: true  },

    // Physics - Additional
    { title: 'Engineering Physics',                    author: 'S.O. Pillai',            isbn: '978-8120338265', rack_location: 'Floor 5, Row B, Rack 1', is_available: false },
    { title: 'Modern Physics',                         author: 'R. Murugeshan',          isbn: '978-8125016816', rack_location: 'Floor 5, Row B, Rack 2', is_available: true  },

    // Chemistry - Additional
    { title: 'Engineering Chemistry',                  author: 'S.S. Dara',              isbn: '978-8121905412', rack_location: 'Floor 5, Row C, Rack 1', is_available: true  },
    { title: 'Applied Chemistry',                      author: 'V.K. Ahluwalia',         isbn: '978-8173719575', rack_location: 'Floor 5, Row C, Rack 2', is_available: true  },

    // Electrical Engineering
    { title: 'Electrical Technology',                  author: 'B.L. Theraja',            isbn: '978-8121927797', rack_location: 'Floor 6, Row A, Rack 1', is_available: false },
    { title: 'Fundamentals of Electrical Engineering', author: 'D.P. Kothari',           isbn: '978-9353167128', rack_location: 'Floor 6, Row A, Rack 2', is_available: true  },

    // Electronics
    { title: 'Microelectronic Circuits',               author: 'Adel S. Sedra',           isbn: '978-0190853464', rack_location: 'Floor 6, Row B, Rack 1', is_available: true  },
    { title: 'Digital Electronics',                    author: 'R.P. Jain',               isbn: '978-0071076648', rack_location: 'Floor 6, Row B, Rack 2', is_available: true  },

    // Computer Science / Programming
    { title: 'The C Programming Language',             author: 'Brian W. Kernighan',     isbn: '978-0131103627', rack_location: 'Floor 6, Row C, Rack 1', is_available: true  },
    { title: 'Let Us C Solutions',                     author: 'Yashavant Kanetkar',      isbn: '978-8183331470', rack_location: 'Floor 6, Row C, Rack 2', is_available: false },

    // Data Structures
    { title: 'Data Structures and Algorithms',          author: 'Narasimha Karumanchi',   isbn: '978-8193245279', rack_location: 'Floor 7, Row A, Rack 1', is_available: true  },
    { title: 'Data Structures Using C',                 author: 'Reema Thareja',          isbn: '978-0198099307', rack_location: 'Floor 7, Row A, Rack 2', is_available: true  },

    // Object Oriented Programming
    { title: 'Programming with Java',                  author: 'E. Balagurusamy',        isbn: '978-9353165278', rack_location: 'Floor 7, Row B, Rack 1', is_available: true  },
    { title: 'Core Java: An Integrated Approach',      author: 'R. Nageswara Rao',       isbn: '978-9353167029', rack_location: 'Floor 7, Row B, Rack 2', is_available: false },

    // Computer Networks / Operating Systems
    { title: 'Computer Networks',                      author: 'Andrew S. Tanenbaum',    isbn: '978-0132126953', rack_location: 'Floor 7, Row C, Rack 1', is_available: true  },
    { title: 'Operating System Concepts',              author: 'Abraham Silberschatz',   isbn: '978-1119456339', rack_location: 'Floor 7, Row C, Rack 2', is_available: true  },

    // Database / Web Technology
    { title: 'Database System Concepts',               author: 'Abraham Silberschatz',   isbn: '978-0078022159', rack_location: 'Floor 8, Row A, Rack 1', is_available: true  },
    { title: 'Web Technologies',                       author: 'Uttam K. Roy',            isbn: '978-0198067897', rack_location: 'Floor 8, Row A, Rack 2', is_available: false },
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
  // Find all books marked as is_available: false and create transactions for them
  const transactions = [];
  books.forEach((book, index) => {
    if (!book.is_available) {
      transactions.push({
        bookIndex: index,
        studentId: `STU-2024-${String(index + 1).padStart(3, '0')}`,
        issueDate: new Date(new Date('2026-08-15T10:00:00').getTime() + index * 86400000)
      });
    }
  });

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
