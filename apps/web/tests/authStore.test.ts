import { describe, it, expect, beforeEach } from 'vitest';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] || null; }
  setItem(key: string, value: string) { this.store[key] = value.toString(); }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
}
(globalThis as any).localStorage = new LocalStorageMock();

import { useAuthStore } from '../src/stores/authStore';
import { UserProfile } from '@online-chess/shared';

describe('Web App: authStore State Management', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  const mockUser: UserProfile = {
    id: 'user-123',
    username: 'GrandmasterPlayer',
    email: 'gm@chess.local',
    isEmailVerified: true,
    role: 'PLAYER',
    eloRating: 1550,
    accountStatus: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should initialize with null user and unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set authentication state and persist credentials', () => {
    useAuthStore.getState().setAuth(mockUser, 'mock-jwt-token');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('GrandmasterPlayer');
    expect(state.token).toBe('mock-jwt-token');
    expect(state.user?.eloRating).toBe(1550);
  });

  it('should update user fields reactively', () => {
    useAuthStore.getState().setAuth(mockUser, 'mock-jwt-token');
    useAuthStore.getState().updateUser({ eloRating: 1600, displayName: 'Master GM' });

    const state = useAuthStore.getState();
    expect(state.user?.eloRating).toBe(1600);
    expect(state.user?.displayName).toBe('Master GM');
    expect(state.user?.username).toBe('GrandmasterPlayer');
  });

  it('should clear all credentials and disconnect on logout', () => {
    useAuthStore.getState().setAuth(mockUser, 'mock-jwt-token');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});
