import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { resolveApiBaseUrl, setStoredDesktopServerUrl } from '../lib/desktop';

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

export function updateApiServerUrl(serverUrl: string) {
  const clean = setStoredDesktopServerUrl(serverUrl);
  api.defaults.baseURL = `${clean}/api/v1`;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Don't auto-logout if we're hitting auth routes (like login or verify) or guest calls
      if (!url.includes('/auth/')) {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);
