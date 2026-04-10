import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Em dev web: localhost funciona direto no browser
// Em dev mobile: precisa do IP da maquina
const getDevApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // Tenta pegar IP do host Expo pra conectar na API local
  try {
    const Constants = require('expo-constants').default;
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    const localIp = debuggerHost?.split(':')[0] || 'localhost';
    return `http://${localIp}:3000`;
  } catch {
    return 'http://localhost:3000';
  }
};

const API_BASE_URL = __DEV__ ? getDevApiUrl() : 'https://api.betbrinks.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('@betbrinks:token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // AsyncStorage pode falhar no web
  }
  return config;
});

// Response interceptor - handle refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('@betbrinks:refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });

        await AsyncStorage.setItem('@betbrinks:token', data.data.accessToken);
        await AsyncStorage.setItem('@betbrinks:refreshToken', data.data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        await AsyncStorage.multiRemove(['@betbrinks:token', '@betbrinks:refreshToken']);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
