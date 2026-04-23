import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.76.63.154:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include JWT token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.token) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      console.error('Login Error:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  register: async (name, email, password) => {
    try {
      const response = await api.post('/auth/register', { name, email, password });
      return response.data;
    } catch (error) {
      console.error('Registration Error:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  logout: async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
  },
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
};

export default api;
