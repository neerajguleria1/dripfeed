import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';
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
  /** Registered by RecentlyViewedSync to trigger post-login anon→backend sync. */
  onLoginSuccess: (() => Promise<void>) | null;
  setOnLoginSuccess: (fn: (() => Promise<void>) | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function saveSession(data: { accessToken: string; refreshToken: string; user: any }) {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
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

  // useRef avoids the React useState function-as-updater pitfall when storing a fn
  const onLoginSuccessRef = useRef<(() => Promise<void>) | null>(null);
  const setOnLoginSuccess = useCallback((fn: (() => Promise<void>) | null) => {
    onLoginSuccessRef.current = fn;
  }, []);

  async function afterLogin(userData: User) {
    setUser(userData);
    if (onLoginSuccessRef.current) {
      try { await onLoginSuccessRef.current(); } catch { /* non-fatal */ }
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
    <AuthContext.Provider value={{
      user, loading, register, login, googleLogin, logout,
      onLoginSuccess: onLoginSuccessRef.current,
      setOnLoginSuccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
