const admin = require('firebase-admin');
require('dotenv').config();

let isInitialized = false;

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    isInitialized = true;
    return admin;
  }

  try {
    // 1. JSON Service Account in ENV (Standard for Render / Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
      });
      isInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT');
      return admin;
    }

    // 2. Individual Environment Variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        }),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      isInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from project credentials');
      return admin;
    }

    // 3. Application Default Credentials (GCP / Local Service Account file)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      isInitialized = true;
      console.log('✅ Firebase Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS');
      return admin;
    }

    // 4. In Production, fail fast if credentials are not configured
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: Firebase Admin SDK credentials missing or incomplete in production environment.');
    }

    // 5. Non-production / Local fallback (Project ID only)
    if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      isInitialized = true;
      console.log(`ℹ️ Firebase Admin SDK initialized with project ID (non-production): ${process.env.FIREBASE_PROJECT_ID}`);
      return admin;
    }

    console.warn('⚠️ [Firebase Admin] Credentials not found in environment. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }

  return admin;
}

initFirebaseAdmin();

/**
 * Verify a Firebase ID Token server-side
 * @param {string} idToken - Client Firebase ID token
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('No Firebase ID token provided.');
    err.code = 'MISSING_TOKEN';
    err.status = 401;
    throw err;
  }

  if (admin.apps.length === 0) {
    const err = new Error('Firebase Admin SDK is not initialized on the server.');
    err.code = 'AUTH_UNINITIALIZED';
    err.status = 500;
    throw err;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    const err = new Error(error.message || 'Invalid or expired Firebase ID token.');
    err.code = error.code || 'INVALID_FIREBASE_TOKEN';
    err.status = 401;
    throw err;
  }
}

module.exports = {
  admin,
  auth: admin.apps.length > 0 ? admin.auth() : null,
  verifyFirebaseIdToken,
  isInitialized: () => admin.apps.length > 0
};
