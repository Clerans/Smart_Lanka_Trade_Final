import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-ignore
  getReactNativePersistence,
  Auth
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe validation of required public Firebase client configuration
const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID'
] as const;

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(
    `[Firebase Config Warning] Incomplete Firebase configuration. Missing environment variables:\n` +
    missingVars.map(v => `- ${v}`).join('\n')
  );
}

// Firebase Client Configuration
// Privileged service-account credentials MUST NEVER be included in frontend.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyA8YZwo5LDc9_rLsxQxEm-D_a-HxHjAW0s',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'smartlankatrade-final.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'smartlankatrade-final',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'smartlankatrade-final.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '345276801948',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:345276801948:web:eccf7408899a769fe91e59'
};

let app: any;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.error('[Firebase Init Error]', e);
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig, 'SmartLankaTrade');
}

let auth: Auth;

try {
  // Use React Native AsyncStorage persistence for React Native / Expo
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // If already initialized (e.g. fast refresh or fallback), fallback to getAuth
  try {
    auth = getAuth(app);
  } catch (authErr) {
    console.error('[Firebase Auth Init Error]', authErr);
    auth = {} as Auth;
  }
}

export { app, auth };
export default app;


