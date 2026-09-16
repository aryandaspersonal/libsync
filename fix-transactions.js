/**
 * fix-transactions.js
 * One-time script to fix stale "Checked Out" transaction records.
 * For each transaction with return_date == null, checks if the book
 * is actually available. If it is, stamps return_date = now.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to find service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found in project root.');
  console.error('   Download it from Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

async function fixTransactions() {
  console.log('🔍 Scanning transactions with null return_date...\n');

  const txnSnapshot = await db.collection('transactions')
    .where('return_date', '==', null)
    .get();

  if (txnSnapshot.empty) {
    console.log('✅ No open transactions found. Everything looks good!');
    return;
  }

  console.log(`Found ${txnSnapshot.size} open transaction(s). Checking books...\n`);

  let fixedCount = 0;
  let stillCheckedOut = 0;

  for (const txnDoc of txnSnapshot.docs) {
    const txn = txnDoc.data();
    const bookId = txn.book_id;

    const bookDoc = await db.collection('books').doc(bookId).get();

    if (!bookDoc.exists) {
      console.log(`  ⚠️  Transaction ${txnDoc.id}: book ${bookId} not found — skipping`);
      continue;
    }

    const book = bookDoc.data();

    if (book.is_available) {
      // Book is available but transaction says "checked out" — fix it
      await txnDoc.ref.update({
        return_date: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✅ FIXED: "${book.title}" (student: ${txn.student_id}) — was stale, now marked returned`);
      fixedCount++;
    } else {
      console.log(`  📤 OK:    "${book.title}" (student: ${txn.student_id}) — genuinely checked out`);
      stillCheckedOut++;
    }
  }

  console.log(`\n── Summary ──────────────────────────────`);
  console.log(`  Fixed (stale → returned): ${fixedCount}`);
  console.log(`  Still checked out:        ${stillCheckedOut}`);
  console.log(`  Total processed:          ${txnSnapshot.size}`);
  console.log(`─────────────────────────────────────────\n`);
}

fixTransactions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
