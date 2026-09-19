import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification as firebaseSendEmailVerification,
  User
} from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * Auxiliary Firebase Email Verification Service
 * 
 * STRICT ARCHITECTURAL SCOPE:
 * This service is used ONLY for delivering Firebase email verification links
 * and polling/refreshing Firebase email verification status.
 * All application authentication, sessions, JWTs, and authorization are strictly
 * managed by the SmartLanka Trade Node.js/Oracle backend.
 */
export const firebaseVerificationService = {
  /**
   * Dispatches a verification email link via Firebase Authentication
   */
  sendVerificationLink: async (email: string, password?: string, displayName?: string): Promise<boolean> => {
    try {
      if (!auth || !auth.app) return false;
      const cleanEmail = email.trim().toLowerCase();
      let currentUser = auth.currentUser;

      if (!currentUser || currentUser.email?.toLowerCase() !== cleanEmail) {
        // Try sign-in or create auxiliary user to send email verification link
        try {
          if (password) {
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            currentUser = cred.user;
          }
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' && password) {
            try {
              const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
              currentUser = newCred.user;
            } catch (createErr) {}
          }
        }
      }

      if (currentUser) {
        await firebaseSendEmailVerification(currentUser);
        console.log(`📧 [Firebase Verification] Sent verification link to ${cleanEmail}`);
        return true;
      }
      return false;
    } catch (error: any) {
      console.warn('⚠️ [Firebase Verification] Could not send verification link:', error.message);
      return false;
    }
  },

  /**
   * Checks if user has verified via email link by reloading Firebase user status
   */
  checkEmailLinkVerified: async (): Promise<boolean> => {
    try {
      if (!auth || !auth.currentUser) return false;
      await auth.currentUser.reload();
      return !!auth.currentUser.emailVerified;
    } catch (error) {
      return false;
    }
  },

  /**
   * Helper to get current Firebase auxiliary user
   */
  getCurrentFirebaseUser: (): User | null => {
    try {
      return auth?.currentUser || null;
    } catch {
      return null;
    }
  }
};
