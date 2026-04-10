import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = __DEV__ ? 'http://localhost:3000' : 'https://api.betbrinks.com';

let socket: Socket | null = null;

export const connectSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('@betbrinks:token');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🟣 Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('⚫ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.log('🔴 Socket error:', error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

// Subscribe to live odds for a specific fixture
export const subscribeFixture = (fixtureId: number) => {
  socket?.emit('subscribe-fixture', { fixtureId });
};

export const unsubscribeFixture = (fixtureId: number) => {
  socket?.emit('unsubscribe-fixture', { fixtureId });
};
