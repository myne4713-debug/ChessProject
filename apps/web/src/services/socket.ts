import { io, Socket } from 'socket.io-client';
import { useAuthStore, registerSocketDisconnectHandler } from '../stores/authStore';
import { resolveSocketBaseUrl, setStoredDesktopServerUrl } from '../lib/desktop';

let socketUrl = resolveSocketBaseUrl();
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;
    socket = io(socketUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function updateSocketServerUrl(nextServerUrl: string) {
  const clean = setStoredDesktopServerUrl(nextServerUrl);
  if (clean === socketUrl) return;
  socketUrl = clean;
  if (socket) {
    socket.disconnect();
    socket = null;
    getSocket();
  }
}

export function reconnectSocketWithAuth() {
  if (socket) {
    socket.disconnect();
    const token = useAuthStore.getState().token;
    socket.auth = { token };
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

registerSocketDisconnectHandler(disconnectSocket);
