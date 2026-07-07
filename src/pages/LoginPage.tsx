import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/common/Logo';
import GoogleAuthButton from '../components/common/GoogleAuthButton';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#0F0F1A] via-[#1A1A2E] to-[#0F0F1A]">
      <div className="bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] p-8 w-full max-w-sm border border-neutral-100">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <Logo variant="dark" size="lg" asLink={false} />
          </div>
          <p className="text-neutral-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#0F0F1A] mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all min-h-[44px]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F0F1A] mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:border-[#C9A96E] transition-all min-h-[44px]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#C9A96E] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#B8964F] disabled:opacity-60 transition-colors min-h-[44px]"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-neutral-200" />
          <span className="text-[12px] text-neutral-400">OR</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>

        <GoogleAuthButton onError={setError} />

        <p className="text-center text-sm text-neutral-500 mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#C9A96E] font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
