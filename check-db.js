const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('books').get();
  const allKeys = new Set();
  snapshot.docs.forEach(doc => {
    Object.keys(doc.data()).forEach(k => allKeys.add(k));
  });
  console.log("All unique keys in 'books' collection:", Array.from(allKeys));
}

check().catch(console.error).finally(() => process.exit(0));
