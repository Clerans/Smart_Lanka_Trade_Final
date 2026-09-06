import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const getBaseUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000/api`;
  }
  return 'http://10.63.164.154:5000/api';
};

const BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach JWT token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // Non-blocking
  }
  return config;
});

// Response interceptor to standardize network and backend error structures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network connection error
      const networkError = {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Network connection failed. Please check your connectivity and try again.'
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

// 1. Authentication Services
export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      await AsyncStorage.setItem('userToken', response.data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  register: async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },
  logout: async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('rememberMe');
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  verifyResetOTP: async (email: string, otp: string) => {
    const response = await api.post('/auth/verify-reset-otp', { email, otp });
    return response.data;
  },
  resetPassword: async (email: string, otp: string, password: string) => {
    const response = await api.post('/auth/reset-password', { email, otp, password });
    return response.data;
  },
  sendVerification: async (email: string) => {
    const response = await api.post('/auth/send-verification', { email });
    return response.data;
  },
  verifyEmail: async (email: string, otp: string) => {
    const response = await api.post('/auth/verify-email', { email, otp });
    return response.data;
  },
  resendVerification: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },
  validateToken: async () => {
    const response = await api.get('/auth/validate-token');
    return response.data;
  },
  googleLogin: async (email: string, name: string, idToken?: string) => {
    const response = await api.post('/auth/google-login', { email, name, idToken });
    if (response.data.token) {
      await AsyncStorage.setItem('userToken', response.data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
    }
    return response.data;
  }
};

// 2. Colombo Stock Exchange (CSE) & Forex Market Data Services
export const marketService = {
  getAllPricesLKR: async () => {
    const response = await api.get('/market/all-prices-lkr');
    return response.data;
  },
  getPriceLKR: async (symbol: string = 'JKH.N0000') => {
    const response = await api.get('/market/price-lkr', {
      params: { symbol }
    });
    return response.data;
  },
  getMultiplePricesLKR: async (symbols: string[] = ['JKH.N0000', 'COMB.N0000', 'SAMP.N0000', 'DIAL.N0000'], includeSparkline: boolean = false) => {
    const response = await api.get('/market/prices-lkr', {
      params: {
        symbols: symbols.join(','),
        sparkline: includeSparkline
      }
    });
    return response.data;
  },
  getLivePrices: async () => {
    const response = await api.get('/market/live');
    return response.data;
  },
  getCandles: async (symbol: string = 'JKH.N0000', period: string = '1D') => {
    const response = await api.get(`/market/candles/${symbol}`, {
      params: { period }
    });
    return response.data;
  },
  getForexRates: async () => {
    const response = await api.get('/market/forex');
    return response.data;
  }
};

// 3. Demo Trading Engine Services
export const tradeService = {
  buy: async (symbol: string, amountLKR?: number, quantity?: number) => {
    const response = await api.post('/trade/buy', { symbol, amountLKR, quantity });
    return response.data;
  },
  sell: async (symbol: string, quantity: number) => {
    const response = await api.post('/trade/sell', { symbol, quantity });
    return response.data;
  }
};

// 4. Portfolio Services
export const portfolioService = {
  getPortfolio: async () => {
    const response = await api.get('/portfolio');
    return response.data;
  }
};

// 5. Virtual Wallet & Currency Conversion Services
export const walletService = {
  getWalletDetails: async () => {
    const response = await api.get('/wallet');
    return response.data;
  },
  getBalance: async () => {
    const response = await api.get('/wallet/balance');
    return response.data;
  },
  deposit: async (amount: number) => {
    const response = await api.post('/wallet/deposit', { amount });
    return response.data;
  },
  convertCurrency: async (fromCurrency: string, toCurrency: string, amount: number) => {
    const response = await api.post('/wallet/convert', { fromCurrency, toCurrency, amount });
    return response.data;
  },
  getTransactions: async () => {
    const response = await api.get('/wallet/transactions');
    return response.data;
  }
};

// 6. Alert Services
export const alertService = {
  createAlert: async (symbol: string, targetPrice: number, alertType: 'ABOVE' | 'BELOW') => {
    const response = await api.post('/alerts', { symbol, targetPrice, alertType });
    return response.data;
  },
  getUserAlerts: async () => {
    const response = await api.get('/alerts');
    return response.data;
  },
  deleteAlert: async (id: number) => {
    const response = await api.delete(`/alerts/${id}`);
    return response.data;
  },
  savePushToken: async (token: string) => {
    const response = await api.post('/alerts/push-token', { token });
    return response.data;
  }
};

// 7. Transaction History Services
export const transactionService = {
  getTransactions: async () => {
    const response = await api.get('/transactions');
    return response.data;
  }
};

// 8. AI/ML, Sentiment, & SOMI Chatbot Services
export const aiService = {
  getInsights: async () => {
    const response = await api.get('/ai/insights');
    return response.data;
  },
  getSentiment: async () => {
    const response = await api.get('/ai/sentiment');
    return response.data;
  },
  getEvaluation: async () => {
    const response = await api.get('/ai/evaluation');
    return response.data;
  },
  sendChatMessage: async (message: string) => {
    const response = await api.post('/ai/chat', { message });
    return response.data;
  }
};

// 9. OCR & KYC Verification Services
export const kycService = {
  verifyNic: async (nicNumber: string, fullName: string, dob?: string, docType: string = 'SRI_LANKAN_NIC') => {
    const response = await api.post('/kyc/verify-nic', { nicNumber, fullName, dob, docType });
    return response.data;
  },
  getStatus: async () => {
    const response = await api.get('/kyc/status');
    return response.data;
  }
};

// 10. Admin Services
export const adminService = {
  getDashboard: async () => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },
  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },
  getAuditLogs: async (limit: number = 50) => {
    const response = await api.get('/admin/audit-logs', { params: { limit } });
    return response.data;
  },
  updateUserRole: async (userId: number, role: 'INVESTOR' | 'ADMIN') => {
    const response = await api.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  }
};

export default api;
