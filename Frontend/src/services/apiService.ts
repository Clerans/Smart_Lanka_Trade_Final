import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { storageService } from './storageService';

// Dynamic Backend Base URL resolver with environment override and production fallback
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'https://smart-lanka-trade-final.onrender.com/api';
};

const BASE_URL = getBaseUrl();
console.log('📡 SmartLanka Trade Frontend API Base URL:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include JWT token from SecureStore
api.interceptors.request.use(async (config) => {
  const token = await storageService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Standardize error structures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network Error
      const networkError = {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Network connection failed. Please check your connection and try again.'
      };
      return Promise.reject(networkError);
    }
    const backendError = error.response.data || {
      success: false,
      code: 'SERVER_ERROR',
      message: error.message || 'An internal server error occurred.'
    };
    return Promise.reject(backendError);
  }
);

export const authService = {
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.token) {
        await storageService.setToken(response.data.token);
        await storageService.setUserData(response.data.user);
      }
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  register: async (name: string, email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  logout: async () => {
    await storageService.clearAuthSession();
    await AsyncStorage.removeItem('rememberMe');
  },
  forgotPassword: async (email: string) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  verifyResetOTP: async (email: string, otp: string) => {
    try {
      const response = await api.post('/auth/verify-reset-otp', { email, otp });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  resetPassword: async (email: string, otp: string, password: string) => {
    try {
      const response = await api.post('/auth/reset-password', { email, otp, password });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  sendVerification: async (email: string) => {
    try {
      const response = await api.post('/auth/send-verification', { email });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  verifyEmail: async (email: string, otp: string) => {
    try {
      const response = await api.post('/auth/verify-email', { email, otp });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  resendVerification: async (email: string) => {
    try {
      const response = await api.post('/auth/resend-verification', { email });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  validateToken: async () => {
    try {
      const response = await api.get('/auth/validate-token');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  googleLogin: async (idToken: string) => {
    try {
      const response = await api.post('/auth/google-login', { idToken });
      if (response.data.token) {
        await storageService.setToken(response.data.token);
        await storageService.setUserData(response.data.user);
      }
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  getProfile: async () => {
    try {
      const response = await api.get('/auth/profile');
      if (response.data && response.data.user) {
        await storageService.setUserData(response.data.user);
      }
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  updateProfile: async (data: { name?: string; email?: string; phoneNumber?: string; profileImage?: string | null }) => {
    try {
      const response = await api.put('/auth/profile', data);
      if (response.data && response.data.user) {
        await storageService.setUserData(response.data.user);
      }
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }
};

export const marketService = {
  getPriceLKR: async (symbol: string = 'BTCUSDT') => {
    try {
      const response = await api.get(`/market/price-lkr`, {
        params: { symbol },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching LKR price:', error);
      throw error;
    }
  },
  getMultiplePricesLKR: async (symbols: string[] = ['BTCUSDT', 'ETHUSDT'], includeSparkline: boolean = false) => {
    try {
      const response = await api.get(`/market/prices-lkr`, {
        params: { 
          symbols: symbols.join(','),
          sparkline: includeSparkline 
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching multiple LKR prices:', error);
      throw error;
    }
  },
  getAllPricesLKR: async () => {
    try {
      const response = await api.get(`/market/all-prices-lkr`);
      return response.data;
    } catch (error) {
      console.error('Error fetching all LKR prices:', error);
      throw error;
    }
  },
  getLivePrices: async () => {
    try {
      const response = await api.get('/market/live');
      return response.data;
    } catch (error) {
      console.error('Error fetching live market prices:', error);
      throw error;
    }
  },
  getKlines: async (symbol: string = 'BTCUSDT', interval: string = '1h', limit: number = 60) => {
    try {
      const response = await api.get(`/market/klines/${symbol}`, {
        params: { interval, limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching klines for ${symbol} (${interval}):`, error);
      throw error;
    }
  },
};

export const walletService = {
  getBalance: async () => {
    try {
      const response = await api.get('/wallet/balance');
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      throw error;
    }
  },
  deposit: async (amount: number) => {
    try {
      const response = await api.post('/wallet/deposit', { amount });
      return response.data;
    } catch (error) {
      console.error('Error depositing money:', error);
      throw error;
    }
  },
  getTransactions: async () => {
    try {
      const response = await api.get('/wallet/transactions');
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },
  getWalletDetails: async () => {
    try {
      const response = await api.get('/wallet');
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet details:', error);
      throw error;
    }
  },
};

export const alertService = {
  createAlert: async (symbol: string, targetPrice: number, alertType: 'ABOVE' | 'BELOW') => {
    try {
      const response = await api.post('/alerts', { symbol, targetPrice, alertType });
      return response.data;
    } catch (error: any) {
      console.error('Error creating alert:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  getUserAlerts: async () => {
    try {
      const response = await api.get('/alerts');
      return response.data;
    } catch (error) {
      console.error('Error fetching alerts:', error);
      throw error;
    }
  },
  deleteAlert: async (id: number) => {
    try {
      const response = await api.delete(`/alerts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw error;
    }
  },
  savePushToken: async (token: string) => {
    try {
      const response = await api.post('/alerts/push-token', { token });
      return response.data;
    } catch (error) {
      console.error('Error saving push token:', error);
      throw error;
    }
  },
};

export const tradeService = {
  buy: async (symbol: string, amountLKR: number) => {
    try {
      const response = await api.post('/trade/buy', { symbol, amountLKR });
      return response.data;
    } catch (error) {
      console.error('Error executing buy trade:', error);
      throw error;
    }
  },
  sell: async (symbol: string, quantity: number) => {
    try {
      const response = await api.post('/trade/sell', { symbol, quantity });
      return response.data;
    } catch (error) {
      console.error('Error executing sell trade:', error);
      throw error;
    }
  }
};

export const portfolioService = {
  getPortfolio: async () => {
    try {
      const response = await api.get('/portfolio');
      return response.data;
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      throw error;
    }
  }
};

export const transactionService = {
  getTransactions: async () => {
    try {
      const response = await api.get('/transactions');
      return response.data;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }
};

export const aiService = {
  getRecommendations: async (interval: string = '1h') => {
    try {
      const response = await api.get('/ai/recommendations', {
        params: { interval }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      throw error;
    }
  },
  getRecommendation: async (symbol: string, interval: string = '1h') => {
    try {
      const response = await api.get(`/ai/recommendation/${symbol}`, {
        params: { interval }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching AI recommendation for ${symbol}:`, error);
      throw error;
    }
  },
  getHistory: async (symbol: string, limit: number = 10) => {
    try {
      const response = await api.get(`/ai/history/${symbol}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching AI history for ${symbol}:`, error);
      throw error;
    }
  },
  chatWithSOMI: async (message: string, symbolContext?: string) => {
    try {
      const response = await api.post('/ai/chat', {
        message,
        symbolContext
      });
      return response.data;
    } catch (error) {
      console.error('Error in SOMI AI chat:', error);
      throw error;
    }
  }
};

export const kycService = {
  submitKYC: async (formData: FormData) => {
    try {
      const token = await storageService.getToken();
      const url = `${BASE_URL}/kyc/verify`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw {
          code: data.code || 'KYC_ERROR',
          message: data.message || 'KYC document verification failed.',
          success: false,
          data: data.data || null
        };
      }
      return data;
    } catch (error: any) {
      console.error('Error submitting KYC document:', error);
      throw error;
    }
  },
  getKYCStatus: async () => {
    try {
      const response = await api.get('/kyc/status');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching KYC status:', error);
      throw error;
    }
  },
  getKYCHistory: async () => {
    try {
      const response = await api.get('/kyc/history');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching KYC history:', error);
      throw error;
    }
  }
};

export default api;

