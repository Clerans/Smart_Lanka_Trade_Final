import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'userToken';
const USER_DATA_KEY = 'userData';

/**
 * Secure storage helper for sensitive authentication tokens and credentials.
 */
export const storageService = {
  // Token methods (Backed by SecureStore)
  getToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving token from SecureStore:', error);
      return null;
    }
  },

  setToken: async (token: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token to SecureStore:', error);
    }
  },

  deleteToken: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error deleting token from SecureStore:', error);
    }
  },

  // User Data methods (Backed by SecureStore for privacy)
  getUserData: async (): Promise<any | null> => {
    try {
      const data = await SecureStore.getItemAsync(USER_DATA_KEY);
      if (data) return JSON.parse(data);
    } catch (error) {
      console.error('Error retrieving userData from SecureStore:', error);
    }
    // Fallback check to AsyncStorage for migration compatibility
    try {
      const fallback = await AsyncStorage.getItem(USER_DATA_KEY);
      if (fallback) return JSON.parse(fallback);
    } catch (e) {}
    return null;
  },

  setUserData: async (user: any): Promise<void> => {
    try {
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving userData to SecureStore:', error);
    }
  },

  deleteUserData: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } catch (error) {
      console.error('Error deleting userData from SecureStore:', error);
    }
  },

  // PIN methods (Backed by SecureStore for hardware security)
  getPin: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync('userSecurityPin');
    } catch (error) {
      console.error('Error retrieving PIN from SecureStore:', error);
      return null;
    }
  },

  setPin: async (pin: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync('userSecurityPin', pin);
    } catch (error) {
      console.error('Error saving PIN to SecureStore:', error);
    }
  },

  deletePin: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync('userSecurityPin');
    } catch (error) {
      console.error('Error deleting PIN from SecureStore:', error);
    }
  },

  // Clear all session credentials
  clearAuthSession: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
      await SecureStore.deleteItemAsync('userSecurityPin');
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
      await AsyncStorage.removeItem('@app_user_pin');
    } catch (error) {
      console.error('Error clearing auth session:', error);
    }
  }
};

