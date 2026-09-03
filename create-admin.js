const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming it's here because seed-firebase.js worked

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createAdmin() {
  try {
    const email = 'admin@library.com';
    const password = 'password123';
    
    try {
      const user = await admin.auth().getUserByEmail(email);
      console.log(`User ${email} already exists with UID: ${user.uid}`);
      // Update password just in case
      await admin.auth().updateUser(user.uid, { password: password });
      console.log(`Password updated to: ${password}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const user = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: 'Library Admin'
        });
        console.log(`Successfully created admin user: ${user.uid}`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
  } finally {
    process.exit(0);
  }
}

createAdmin();
