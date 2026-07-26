import { createContext, useContext, useState, type ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => void;
  /** Set by useRecentlyViewed to trigger post-login sync. */
  onLoginSuccess: (() => Promise<void>) | null;
  setOnLoginSuccess: (fn: (() => Promise<void>) | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function saveSession(data: { accessToken: string; refreshToken: string; user: any }) {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  // Normalize: backend returns id, ensure role exists (decoded from JWT if missing)
  const user: User = {
    id: data.user.id || data.user._id,
    name: data.user.name || '',
    email: data.user.email,
    role: data.user.role || 'user',
    image: data.user.image,
  };
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [onLoginSuccess, setOnLoginSuccess] = useState<(() => Promise<void>) | null>(null);

  async function afterLogin(userData: User) {
    setUser(userData);
    if (onLoginSuccess) {
      try { await onLoginSuccess(); } catch { /* non-fatal */ }
    }
  }

  async function register(name: string, email: string, password: string) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      await afterLogin(saveSession(data));
    } finally { setLoading(false); }
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await afterLogin(saveSession(data));
    } finally { setLoading(false); }
  }

  async function googleLogin(idToken: string) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/google', { idToken });
      await afterLogin(saveSession(data));
    } finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, googleLogin, logout, onLoginSuccess, setOnLoginSuccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
