/* ═══════════════════════════════════════════════════════════════════
   Firebase Configuration — LibSync
   Replace the values below with your own Firebase project config.
   Find it at: Firebase Console → Project Settings → General → Your apps
   ═══════════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyCI0C8euY5pDqb6W6Ud7ISIYsFyehhOjsQ",
  authDomain: "labsync-d53dc.firebaseapp.com",
  projectId: "labsync-d53dc",
  storageBucket: "labsync-d53dc.firebasestorage.app",
  messagingSenderId: "7891297206",
  appId: "1:7891297206:web:f754a514580b8d22815717",
  measurementId: "G-SKJ6HZ8BJW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firestore and Auth instances as globals
const db = firebase.firestore();
const auth = firebase.auth();
