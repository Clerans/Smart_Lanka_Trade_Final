import { firebaseVerificationService } from './firebaseVerificationService';

/**
 * @deprecated SmartLanka Trade uses native Node.js + Express + Oracle JWT authentication.
 * Firebase is strictly limited to auxiliary email verification link dispatch.
 * Use `authService` in `apiService.ts` for all application authentication.
 */
export const firebaseAuthService = {
  getCurrentUser: () => firebaseVerificationService.getCurrentFirebaseUser(),
  sendEmailVerification: async () => {
    const user = firebaseVerificationService.getCurrentFirebaseUser();
    if (user && user.email) {
      return await firebaseVerificationService.sendVerificationLink(user.email);
    }
    return false;
  },
  reloadUser: async () => {
    const user = firebaseVerificationService.getCurrentFirebaseUser();
    if (user) {
      await user.reload();
      return user;
    }
    return null;
  },
  getIdToken: async () => {
    const user = firebaseVerificationService.getCurrentFirebaseUser();
    if (user) {
      try {
        return await user.getIdToken();
      } catch (e) {
        return null;
      }
    }
    return null;
  },
  logout: async () => {
    // Auxiliary cleanup
  }
};
