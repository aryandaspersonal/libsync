require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// Initialize Firebase Admin (Requires Service Account in .env)
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error.message);
  }
} else {
  console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT_PATH not found in .env. Cron jobs will not work.");
}

const db = admin.apps.length ? admin.firestore() : null;

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // e.g., your-email@gmail.com
    pass: process.env.EMAIL_PASS, // e.g., 16-character app password
  }
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve the static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to serve index.html for SPA routing
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Cron Jobs ──────────────────────────────────────────────────

// Run every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  if (!db) {
    console.error("Cannot run cron jobs: Firestore is not initialized.");
    return;
  }
  console.log("Running daily overdue and fine checks...");

  try {
    const now = admin.firestore.Timestamp.now();
    
    // 1. Check for books that are overdue and haven't received a warning yet
    const overdueSnapshot = await db.collection('transactions')
      .where('return_date', '==', null)
      .where('warning_sent', '==', false)
      .where('due_date', '<', now)
      .get();
      
    console.log(`Found ${overdueSnapshot.empty ? 0 : overdueSnapshot.size} transactions needing a warning.`);

    overdueSnapshot.forEach(async (doc) => {
      const data = doc.data();
      const bookRef = await db.collection('books').doc(data.book_id).get();
      const bookTitle = bookRef.exists ? bookRef.data().title : 'Unknown Book';

      // Send Warning Email
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await transporter.sendMail({
            from: `"LibSync Library" <${process.env.EMAIL_USER}>`,
            to: data.student_id, // Assuming student_id is an email
            subject: '⚠️ Overdue Book Warning',
            text: `Dear ${data.student_name},\n\nThis is a warning that the book "${bookTitle}" was due on ${data.due_date.toDate().toLocaleDateString()} and is now overdue. Please return it immediately to avoid a ₹1000 fine.\n\nThank you,\nLibSync Team`
          });
          
          await doc.ref.update({
            warning_sent: true,
            warning_date: now
          });
          console.log(`Sent warning to ${data.student_id}`);
        } catch (emailErr) {
          console.error(`Failed to send warning email to ${data.student_id}:`, emailErr);
        }
      } else {
        console.log(`Simulated sending warning to ${data.student_id} (No SMTP configured)`);
        await doc.ref.update({ warning_sent: true, warning_date: now });
      }
    });

    // 2. Check for books that had a warning sent > 2 days ago and have no fine applied
    // (We calculate 2 days ago in Timestamp format)
    const twoDaysAgoMillis = Date.now() - (2 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = admin.firestore.Timestamp.fromMillis(twoDaysAgoMillis);

    const fineSnapshot = await db.collection('transactions')
      .where('return_date', '==', null)
      .where('warning_sent', '==', true)
      .where('fine_applied', '==', false)
      .where('warning_date', '<', twoDaysAgo)
      .get();

    console.log(`Found ${fineSnapshot.empty ? 0 : fineSnapshot.size} transactions needing a fine.`);

    fineSnapshot.forEach(async (doc) => {
      const data = doc.data();
      const bookRef = await db.collection('books').doc(data.book_id).get();
      const bookTitle = bookRef.exists ? bookRef.data().title : 'Unknown Book';

      // Send Fine Email
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await transporter.sendMail({
            from: `"LibSync Library" <${process.env.EMAIL_USER}>`,
            to: data.student_id,
            subject: '🚨 Book Fine Applied',
            text: `Dear ${data.student_name},\n\nBecause the book "${bookTitle}" was not returned after our previous warning, a fine of ₹1000 has been applied to your account. Please return the book and clear the fine as soon as possible.\n\nThank you,\nLibSync Team`
          });

          await doc.ref.update({
            fine_applied: true,
            fine_amount: 1000
          });
          console.log(`Sent fine notice to ${data.student_id}`);
        } catch (emailErr) {
          console.error(`Failed to send fine email to ${data.student_id}:`, emailErr);
        }
      } else {
        console.log(`Simulated sending fine notice to ${data.student_id} (No SMTP configured)`);
        await doc.ref.update({ fine_applied: true, fine_amount: 1000 });
      }
    });

  } catch (error) {
    console.error("Error running cron jobs:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
