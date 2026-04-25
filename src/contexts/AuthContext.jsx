/**
 * AuthContext — React Context for GitHub OAuth session state.
 *
 * Provides:
 *   - user: object with {id, login, avatar_url, name} or null
 *   - token: JWT string or null
 *   - isAuthenticated: boolean
 *   - loading: true while validating stored token on mount
 *   - login(token): store JWT + fetch user profile
 *   - logout(): clear session
 *
 * How it works:
 *   1. On mount, checks localStorage for a saved JWT token
 *   2. If found, validates it by calling GET /api/auth/me
 *   3. If valid, sets user state; if expired/invalid, clears it
 *   4. login() is called after OAuth callback with the new JWT
 *   5. logout() clears localStorage and resets state
 *
 * Usage in components:
 *   import { useAuth } from '../contexts/AuthContext';
 *   const { user, isAuthenticated, logout } = useAuth();
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'depshield_auth_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Validate a JWT by calling the backend /api/auth/me endpoint.
   * If the token is valid, returns user profile data.
   * If expired or invalid, returns null.
   */
  const validateToken = useCallback(async (jwt) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${jwt}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  /**
   * On mount: check for an existing token in localStorage
   * and validate it with the backend.
   */
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) {
        const userData = await validateToken(saved);
        if (userData) {
          setToken(saved);
          setUser(userData);
        } else {
          // Token is expired or invalid — clean up
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    };
    init();
  }, [validateToken]);

  /**
   * Login: store the JWT and fetch user profile.
   * Called after the OAuth callback provides a token.
   */
  const login = useCallback(async (jwt) => {
    localStorage.setItem(TOKEN_KEY, jwt);
    setToken(jwt);
    const userData = await validateToken(jwt);
    if (userData) {
      setUser(userData);
    }
  }, [validateToken]);

  /**
   * Logout: clear all auth state and remove from localStorage.
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state from any component.
 *
 * Example:
 *   const { user, isAuthenticated, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
