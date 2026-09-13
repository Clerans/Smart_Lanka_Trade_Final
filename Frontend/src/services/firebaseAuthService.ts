import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  User,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { storageService } from './storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Maps Firebase auth error codes to clean, secure user-friendly messages
 */
export const mapFirebaseAuthError = (error: any): string => {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please log in or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is currently disabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Must be at least 8 characters with letters, numbers, and symbols.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes before trying again.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection.';
    case 'auth/requires-recent-login':
      return 'Please log in again to perform this sensitive action.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completion.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
};

export const firebaseAuthService = {
  /**
   * Register a new user with Firebase Authentication
   */
  register: async (name: string, email: string, password: string): Promise<{ user: User }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // Set display name on Firebase user
      try {
        await updateProfile(user, { displayName: cleanName });
      } catch (profileErr) {
        console.warn('Could not update Firebase profile displayName:', profileErr);
      }

      // Automatically send Firebase email verification
      try {
        await firebaseSendEmailVerification(user);
      } catch (verifyErr) {
        console.warn('Could not send initial verification email:', verifyErr);
      }

      // Cache token in SecureStore
      const token = await user.getIdToken();
      await storageService.setToken(token);

      return { user };
    } catch (error: any) {
      const userMessage = mapFirebaseAuthError(error);
      const customErr: any = new Error(userMessage);
      customErr.code = error.code || 'REGISTER_FAILED';
      customErr.original = error;
      throw customErr;
    }
  },

  /**
   * Log in with Email and Password
   */
  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      await storageService.setToken(token);
      return { user, token };
    } catch (error: any) {
      const userMessage = mapFirebaseAuthError(error);
      const customErr: any = new Error(userMessage);
      customErr.code = error.code || 'LOGIN_FAILED';
      customErr.original = error;
      throw customErr;
    }
  },

  /**
   * Log out of Firebase and clear local credentials
   */
  logout: async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Error signing out of Firebase:', err);
    }
    await storageService.clearAuthSession();
    await AsyncStorage.removeItem('rememberMe');
  },

  /**
   * Send Firebase Email Verification
   */
  sendEmailVerification: async (user?: User): Promise<void> => {
    const targetUser = user || auth.currentUser;
    if (!targetUser) {
      throw new Error('No authenticated user found to send verification email.');
    }
    try {
      await firebaseSendEmailVerification(targetUser);
    } catch (error: any) {
      const userMessage = mapFirebaseAuthError(error);
      const customErr: any = new Error(userMessage);
      customErr.code = error.code;
      throw customErr;
    }
  },

  /**
   * Send Password Reset Email
   */
  sendPasswordReset: async (email: string): Promise<void> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (error: any) {
      const userMessage = mapFirebaseAuthError(error);
      const customErr: any = new Error(userMessage);
      customErr.code = error.code;
      throw customErr;
    }
  },

  /**
   * Reload current user to check latest emailVerified status
   */
  reloadUser: async (): Promise<User | null> => {
    const user = auth.currentUser;
    if (user) {
      await user.reload();
      return auth.currentUser;
    }
    return null;
  },

  /**
   * Get fresh Firebase ID Token for API requests
   */
  getIdToken: async (forceRefresh = false): Promise<string | null> => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken(forceRefresh);
        if (token) {
          await storageService.setToken(token);
        }
        return token;
      } catch (err) {
        console.warn('Could not refresh Firebase ID token:', err);
      }
    }
    return await storageService.getToken();
  },

  /**
   * Get current Firebase User
   */
  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  /**
   * Sign In using Google Credential (via OAuth ID Token)
   */
  signInWithGoogleIdToken: async (idToken: string, accessToken?: string): Promise<{ user: User; token: string }> => {
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      const token = await user.getIdToken();

      await storageService.setToken(token);
      return { user, token };
    } catch (error: any) {
      const userMessage = mapFirebaseAuthError(error);
      const customErr: any = new Error(userMessage);
      customErr.code = error.code || 'GOOGLE_AUTH_FAILED';
      throw customErr;
    }
  },

  /**
   * Listen to Firebase Auth state changes
   */
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  }
};
