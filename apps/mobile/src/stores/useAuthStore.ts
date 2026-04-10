import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: User, token: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, token, refreshToken) => {
    await AsyncStorage.setItem('@betbrinks:token', token);
    await AsyncStorage.setItem('@betbrinks:refreshToken', refreshToken);
    await AsyncStorage.setItem('@betbrinks:user', JSON.stringify(user));
    set({ user, token, refreshToken, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await AsyncStorage.multiRemove([
      '@betbrinks:token',
      '@betbrinks:refreshToken',
      '@betbrinks:user',
    ]);
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  },

  loadFromStorage: async () => {
    try {
      const [token, refreshToken, userJson] = await AsyncStorage.multiGet([
        '@betbrinks:token',
        '@betbrinks:refreshToken',
        '@betbrinks:user',
      ]);

      if (token[1] && userJson[1]) {
        const user = JSON.parse(userJson[1]);
        set({
          user,
          token: token[1],
          refreshToken: refreshToken[1],
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));
