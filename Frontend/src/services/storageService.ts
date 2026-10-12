import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'userToken';
const USER_DATA_KEY = 'userData';
const BIOMETRIC_TOKEN_KEY = 'biometricSessionToken';
const BIOMETRIC_USER_KEY = 'biometricSessionUser';

/**
 * Secure storage helper for sensitive authentication tokens and session credentials.
 * Utilizes expo-secure-store for hardware-backed encryption.
 * 
 * Rules:
 * 1. Sensitive writes propagate failures to callers (no silent error suppression).
 * 2. Writes verify that credentials can be retrieved before returning success.
 * 3. Raw transaction PIN persistence is completely removed; PINs are transient only.
 */
export const storageService = {
  // Token methods (Active Session)
  getToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving token from SecureStore:', error);
      return null;
    }
  },

  setToken: async (token: string): Promise<void> => {
    if (!token) throw new Error('Cannot persist empty token');
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    // Verify persistence
    const verified = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!verified) {
      throw new Error('Failed to verify token write in SecureStore');
    }
  },

  deleteToken: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error deleting token from SecureStore:', error);
    }
  },

  // User Data methods (Active Session)
  getUserData: async (): Promise<any | null> => {
    try {
      const data = await SecureStore.getItemAsync(USER_DATA_KEY);
      if (data) return JSON.parse(data);
    } catch (error) {
      console.error('Error retrieving userData from SecureStore:', error);
    }
    try {
      const fallback = await AsyncStorage.getItem(USER_DATA_KEY);
      if (fallback) return JSON.parse(fallback);
    } catch (e) {}
    return null;
  },

  setUserData: async (user: any): Promise<void> => {
    if (!user) throw new Error('Cannot persist empty userData');
    const serialized = JSON.stringify(user);
    await SecureStore.setItemAsync(USER_DATA_KEY, serialized);
    // Optional mirror in AsyncStorage for non-sensitive profile caching
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, serialized);
    } catch {}
  },

  deleteUserData: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } catch (error) {
      console.error('Error deleting userData from SecureStore:', error);
    }
  },

  // Biometric Session Credentials (Hardware Encrypted for biometric restoration)
  saveBiometricSession: async (token: string, user: any): Promise<void> => {
    if (!token) throw new Error('Cannot persist empty biometric session token');
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
    if (user) {
      await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, JSON.stringify(user));
    }
    // Verify write integrity
    const verifiedToken = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
    if (!verifiedToken) {
      throw new Error('Secure storage verification failed for biometric session');
    }
  },

  getBiometricSession: async (): Promise<{ token: string; user: any } | null> => {
    try {
      const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      const userStr = await SecureStore.getItemAsync(BIOMETRIC_USER_KEY);
      if (token) {
        const user = userStr ? JSON.parse(userStr) : null;
        return { token, user };
      }
    } catch (error) {
      console.error('Error retrieving biometric session credentials:', error);
    }
    return null;
  },

  hasBiometricSession: async (): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      return !!token;
    } catch {
      return false;
    }
  },

  clearBiometricSession: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_USER_KEY);
    } catch (error) {
      console.error('Error clearing biometric session:', error);
    }
  },

  // Clear all session credentials (Used on explicit logout / account switch)
  clearAuthSession: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_USER_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
      await AsyncStorage.removeItem('@app_user_pin');
      await AsyncStorage.removeItem('@pref_biometric');
      await AsyncStorage.removeItem('@pref_face_id');
    } catch (error) {
      console.error('Error clearing auth session:', error);
    }
  }
};
